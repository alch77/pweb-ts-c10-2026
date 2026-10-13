import { requireRole } from "./guards.js";
import { getSession, getQueueMaster, getTickets } from "./storage.js";
import { logout } from "./auth.js";
import {
  PRIORITY_LABEL,
  STATUS_LABEL,
  callNextTicket,
  compareTicketsByPriority,
  finishCurrentTicket,
  getCurrentCalled,
  getNextTicket,
  skipCurrentTicket,
  speakTicket,
  warmUpSpeech,
} from "./queue-service.js";
import { el, formatClock, setMessage } from "./dom.js";
import type { Ticket } from "./types.js";

// Auth Guard + Role Guard (revisi 13 Okt 2026): operator khusus
// admin & moderator. Role user hanya boleh ambil-antrean + layar.
if (requireRole(["admin", "moderator"])) {
  initOperatorPage();
}

function queueNameOf(code: string): string {
  return getQueueMaster().find((queue) => queue.code === code)?.name ?? code;
}

function initOperatorPage(): void {
  const session = getSession();
  const userName = document.querySelector<HTMLElement>("#userName");
  const userRole = document.querySelector<HTMLElement>("#userRole");
  const logoutButton = document.querySelector<HTMLButtonElement>("#logoutButton");
  const welcome = document.querySelector<HTMLElement>("#welcomeMessage");

  const currentNumber = document.querySelector<HTMLElement>("#currentNumber");
  const currentDetail = document.querySelector<HTMLElement>("#currentDetail");
  const nextNumber = document.querySelector<HTMLElement>("#nextNumber");
  const nextDetail = document.querySelector<HTMLElement>("#nextDetail");
  const waitingCount = document.querySelector<HTMLElement>("#waitingCount");
  const message = document.querySelector<HTMLElement>("#operatorMessage");
  const table = document.querySelector<HTMLTableSectionElement>("#operatorTable");
  const lastUpdated = document.querySelector<HTMLElement>("#lastUpdated");
  const toast = document.querySelector<HTMLElement>("#toast");

  const callNextButton = document.querySelector<HTMLButtonElement>("#callNextButton");
  const skipButton = document.querySelector<HTMLButtonElement>("#skipButton");
  const finishButton = document.querySelector<HTMLButtonElement>("#finishButton");
  const soundButton = document.querySelector<HTMLButtonElement>("#soundButton");

  if (!currentNumber || !table || !callNextButton || !skipButton || !finishButton) {
    console.error("Elemen halaman operator tidak lengkap.");
    return;
  }

  const currentNumberEl: HTMLElement = currentNumber;
  const tableEl: HTMLTableSectionElement = table;
  const callNextEl: HTMLButtonElement = callNextButton;
  const skipEl: HTMLButtonElement = skipButton;
  const finishEl: HTMLButtonElement = finishButton;

  if (session) {
    if (userName) userName.textContent = session.firstName;
    if (userRole) userRole.textContent = session.role;
    if (welcome) welcome.textContent = `Halo, ${session.firstName}! Kelola pemanggilan.`;
  }

  logoutButton?.addEventListener("click", logout);

  // Siapkan suara sejak interaksi pertama agar klik panggil perdana bersuara.
  window.addEventListener("pointerdown", warmUpSpeech, { once: true });

  let soundOn = true;
  let toastTimer: number | undefined;

  function showToast(text: string): void {
    if (!toast) return;
    toast.textContent = text;
    toast.hidden = false;
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      toast.hidden = true;
    }, 3200);
  }

  function speakIfEnabled(ticket: Ticket | null): void {
    if (!soundOn || !ticket) return;
    speakTicket(ticket, queueNameOf(ticket.queueType));
  }

  function render(): void {
    const tickets = getTickets();
    const current = getCurrentCalled(tickets);
    const next = getNextTicket(tickets);
    const waiting = tickets.filter((ticket) => ticket.status === "menunggu");

    if (current) {
      currentNumberEl.textContent = current.queueNumber;
      if (currentDetail) {
        currentDetail.textContent = `${queueNameOf(current.queueType)} · ${PRIORITY_LABEL[current.priority]}`;
      }
    } else {
      currentNumberEl.textContent = "-";
      if (currentDetail) currentDetail.textContent = "Belum ada tiket dipanggil.";
    }

    if (next) {
      if (nextNumber) {
        nextNumber.textContent = next.queueNumber;
      }
      if (nextDetail) {
        nextDetail.textContent = `${queueNameOf(next.queueType)} · ${PRIORITY_LABEL[next.priority]}`;
      }
    } else {
      if (nextNumber) nextNumber.textContent = "-";
      if (nextDetail) nextDetail.textContent = "Antrean kosong.";
    }

    if (waitingCount) waitingCount.textContent = String(waiting.length);

    skipEl.disabled = !current;
    finishEl.disabled = !current;
    callNextEl.disabled = !current && !next;

    renderTable(tickets);

    if (lastUpdated) lastUpdated.textContent = `Diperbarui ${formatClock()}`;
  }

  function renderTable(tickets: Ticket[]): void {
    tableEl.replaceChildren();

    const visible = [...tickets].sort((a, b) => {
      // Dipanggil paling atas, lalu menunggu urut prioritas, sisanya kronologis.
      if (a.status === "dipanggil" && b.status !== "dipanggil") return -1;
      if (b.status === "dipanggil" && a.status !== "dipanggil") return 1;
      if (a.status === "menunggu" && b.status === "menunggu") {
        return compareTicketsByPriority(a, b);
      }
      return b.createdAt.localeCompare(a.createdAt);
    }).slice(0, 30);

    if (visible.length === 0) {
      const row = el("tr", {}, [
        el("td", { text: "Belum ada antrean.", attrs: { colspan: "4" } }),
      ]);
      tableEl.append(row);
      return;
    }

    visible.forEach((ticket) => {
      const row = el("tr", {}, [
        el("td", {}, [el("strong", { text: ticket.queueNumber })]),
        el("td", { text: queueNameOf(ticket.queueType) }),
        el("td", {}, [
          el("span", {
            class: `badge badge-${ticket.priority}`,
            text: PRIORITY_LABEL[ticket.priority],
          }),
        ]),
        el("td", {}, [
          el("span", {
            class: `badge status-${ticket.status}`,
            text: STATUS_LABEL[ticket.status],
          }),
        ]),
      ]);
      tableEl.append(row);
    });
  }

  callNextEl.addEventListener("click", () => {
    const result = callNextTicket();

    if (!result.ok) {
      setMessage(message, result.error, "error");
      return;
    }

    speakIfEnabled(result.data.called);

    if (result.data.called) {
      const done = result.data.finished
        ? ` ${result.data.finished.queueNumber} diselesaikan.`
        : "";
      setMessage(
        message,
        `Memanggil ${result.data.called.queueNumber}.${done}`,
        "success",
      );
      showToast(`Memanggil ${result.data.called.queueNumber}`);
    } else {
      setMessage(
        message,
        `${result.data.finished?.queueNumber ?? "Tiket"} diselesaikan. Antrean kosong.`,
        "success",
      );
    }

    render();
  });

  skipEl.addEventListener("click", () => {
    const result = skipCurrentTicket();

    if (!result.ok) {
      setMessage(message, result.error, "error");
      return;
    }

    speakIfEnabled(result.data.called);
    setMessage(
      message,
      result.data.called
        ? `${result.data.skipped.queueNumber} dilewati. Memanggil ${result.data.called.queueNumber}.`
        : `${result.data.skipped.queueNumber} dilewati. Antrean kosong.`,
      "success",
    );
    showToast(`${result.data.skipped.queueNumber} dilewati.`);

    render();
  });

  finishEl.addEventListener("click", () => {
    const result = finishCurrentTicket();

    if (!result.ok) {
      setMessage(message, result.error, "error");
      return;
    }

    setMessage(message, `${result.data.queueNumber} selesai.`, "success");
    showToast(`${result.data.queueNumber} selesai.`);

    render();
  });

  soundButton?.addEventListener("click", () => {
    soundOn = !soundOn;
    soundButton.textContent = soundOn ? "Suara: Aktif" : "Suara: Mati";
    soundButton.setAttribute("aria-pressed", String(soundOn));
  });

  window.addEventListener("storage", render);
  window.setInterval(render, 2500);

  render();
}
