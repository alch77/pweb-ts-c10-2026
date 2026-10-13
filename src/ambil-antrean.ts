import { requireAuth } from "./guards.js";
import { getSession, getQueueMaster, getTickets } from "./storage.js";
import { logout } from "./auth.js";
import {
  LAST_TICKET_KEY,
  PRIORITY_LABEL,
  STATUS_LABEL,
  countWaiting,
  issueTicket,
} from "./queue-service.js";
import { el, formatClock, setMessage } from "./dom.js";
import type { QueueMaster, QueuePriority } from "./types.js";

// Auth Guard (revisi 13 Okt 2026): ambil antrean bersifat protected,
// wajib login. Semua role yang login (admin/moderator/user) boleh
// mengambil tiket mandiri.
if (requireAuth()) {
  initTakePage();
}

function initTakePage(): void {
  const session = getSession();
  const userName = document.querySelector<HTMLElement>("#userName");
  const userRole = document.querySelector<HTMLElement>("#userRole");
  const logoutButton =
    document.querySelector<HTMLButtonElement>("#logoutButton");

  const serviceGrid = document.querySelector<HTMLElement>("#serviceGrid");
  const takeMessage = document.querySelector<HTMLElement>("#takeMessage");
  const lastUpdated = document.querySelector<HTMLElement>("#lastUpdated");

  const ticketResult = document.querySelector<HTMLElement>("#ticketResult");
  const ticketNumber = document.querySelector<HTMLElement>("#ticketNumber");
  const ticketDetail = document.querySelector<HTMLElement>("#ticketDetail");
  const ticketStatus = document.querySelector<HTMLElement>("#ticketStatus");
  const ticketHint = document.querySelector<HTMLElement>("#ticketHint");
  const ticketDismiss =
    document.querySelector<HTMLButtonElement>("#ticketDismiss");

  if (session) {
    if (userName) userName.textContent = session.firstName;
    if (userRole) userRole.textContent = session.role;
  }

  logoutButton?.addEventListener("click", logout);

  // prioritas yang boleh dipilih lewat menu "Ambil dengan prioritas"
  const EXTRA_PRIORITIES: QueuePriority[] = ["lansia", "disabilitas", "vip"];

  let renderedSignature = "";
  let cooldown = false;

  const waitingLabels = new Map<string, HTMLElement>();

  // kartu yang prioritasnya sedang dipertahankan saat render ulang
  const openMenus = new Set<string>();

  // kartu jenis antrean
  function createCard(queue: QueueMaster): HTMLElement {
    const takeButton = el("button", {
      class: "btn btn-block",
      text: "Ambil Nomor",
      attrs: {
        type: "button",
        "data-code": queue.code,
        "data-priority": "normal",
      },
    });

    const waiting = el("p", { class: "queue-meta", text: "0 menunggu" });
    waitingLabels.set(queue.code, waiting);

    const card = el(
      "article",
      { class: "service-card" },
      [
        el("header", { class: "service-card-head" }, [
          el("h3", { text: queue.name }),
          el("span", { class: "code-chip", text: queue.code }),
        ]),
      ],
    );

    const priorityButtons = EXTRA_PRIORITIES.map((priority) =>
      el("button", {
        class: "btn btn-ghost btn-sm",
        text: PRIORITY_LABEL[priority],
        attrs: {
          type: "button",
          "data-code": queue.code,
          "data-priority": priority,
        },
      }),
    );

    const menu = el("details", { class: "priority-menu" }, [
      el("summary", { text: "Ambil dengan prioritas" }),
      el("div", { class: "priority-actions" }, priorityButtons),
    ]);

    menu.open = openMenus.has(queue.code);
    menu.addEventListener("toggle", () => {
      if (menu.open) openMenus.add(queue.code);
      else openMenus.delete(queue.code);
    });

    card.append(takeButton, menu, waiting);

    return card;
  }

  function renderCards(queues: QueueMaster[]): void {
    if (!serviceGrid) return;

    waitingLabels.clear();
    serviceGrid.replaceChildren();

    // Hanya layanan aktif yang ditampilkan; nonaktif tidak bisa dipilih
    // sekaligus tidak muncul di halaman pengambilan tiket.
    const active = queues.filter((queue) => queue.isActive);

    if (active.length === 0) {
      serviceGrid.append(
        el("p", {
          class: "empty-state",
          text: "Belum ada layanan aktif. Silakan hubungi petugas.",
        }),
      );
      return;
    }

    active.forEach((queue) => serviceGrid.append(createCard(queue)));
  }

  // tiket terakhir
  function renderLastTicket(): void {
    if (!ticketResult || !ticketNumber) return;

    const lastId = localStorage.getItem(LAST_TICKET_KEY);
    const ticket = lastId
      ? getTickets().find((item) => item.id === lastId)
      : undefined;

    if (!ticket) {
      ticketResult.hidden = true;
      return;
    }

    const queue = getQueueMaster().find(
      (item) => item.code === ticket.queueType,
    );

    ticketNumber.textContent = ticket.queueNumber;

    if (ticketDetail) {
      ticketDetail.textContent = `${queue?.name ?? ticket.queueType} · Prioritas ${
        PRIORITY_LABEL[ticket.priority] ?? ticket.priority
      }`;
    }

    if (ticketStatus) {
      ticketStatus.textContent = STATUS_LABEL[ticket.status] ?? ticket.status;
      ticketStatus.className = `badge status-${ticket.status}`;
    }

    if (ticketHint) {
      const hints: Record<string, string> = {
        menunggu: "Silakan tunggu sampai nomor kamu dipanggil.",
        dipanggil: "Nomor kamu sedang dipanggil. Silakan menuju loket.",
        selesai: "Pelayanan selesai.",
        dilewati: "Nomor kamu dilewati. Hubungi petugas.",
        dibatalkan: "Tiket dibatalkan.",
      };
      ticketHint.textContent = hints[ticket.status] ?? "";
    }

    ticketResult.hidden = false;
  }

  // sinkronisasi
  function refresh(): void {
    const queues = getQueueMaster();
    const tickets = getTickets();

    const signature = JSON.stringify(queues);

    if (signature !== renderedSignature) {
      renderedSignature = signature;
      renderCards(queues);
    }

    waitingLabels.forEach((label, code) => {
      label.textContent = `${countWaiting(tickets, code)} menunggu`;
    });

    renderLastTicket();

    if (lastUpdated) lastUpdated.textContent = formatClock();
  }

  // ambil tiket
  serviceGrid?.addEventListener("click", (event: MouseEvent) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>(
      "button[data-code]",
    );

    if (!button || button.disabled || cooldown) return;

    cooldown = true;
    window.setTimeout(() => {
      cooldown = false;
    }, 700);

    const code = button.dataset.code ?? "";
    const priority = (button.dataset.priority ?? "normal") as QueuePriority;

    const result = issueTicket(code, priority);

    if (!result.ok) {
      setMessage(takeMessage, result.error, "error");
      refresh();
      return;
    }

    localStorage.setItem(LAST_TICKET_KEY, result.data.id);

    setMessage(
      takeMessage,
      `Nomor antrean ${result.data.queueNumber} berhasil dibuat.`,
      "success",
    );

    refresh();
    ticketResult?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  });

  ticketDismiss?.addEventListener("click", () => {
    localStorage.removeItem(LAST_TICKET_KEY);
    setMessage(takeMessage, "", "");
    renderLastTicket();
  });

  // jenis antrean baru dari dashboard admin (muncul otomatis)
  window.addEventListener("storage", refresh);
  window.setInterval(refresh, 2500);

  refresh();
}
