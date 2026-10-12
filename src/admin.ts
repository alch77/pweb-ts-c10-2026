import { requireRole } from "./guards.js";
import { getSession, getQueueMaster, getTickets } from "./storage.js";
import { logout } from "./auth.js";
import {
  PRIORITY_LABEL,
  PRIORITY_OPTIONS,
  STATUS_LABEL,
  addQueueType,
  countWaiting,
  deleteQueueType,
  isPriority,
  issueTicket,
  resetQueues,
  toggleQueueType,
} from "./queue-service.js";
import { el, setMessage } from "./dom.js";
import type { QueueMaster, Ticket } from "./types.js";

// Auth Guard + Role Guard: hanya admin & moderator (hak akses disamakan)
if (requireRole(["admin", "moderator"])) {
  initAdminPage();
}

function initAdminPage(): void {
  const userName = document.querySelector<HTMLElement>("#userName");
  const userRole = document.querySelector<HTMLElement>("#userRole");
  const logoutButton =
    document.querySelector<HTMLButtonElement>("#logoutButton");
  const resetButton = document.querySelector<HTMLButtonElement>("#resetButton");

  const queueTypeForm =
    document.querySelector<HTMLFormElement>("#queueTypeForm");
  const codeInput = document.querySelector<HTMLInputElement>("#queueCode");
  const nameInput = document.querySelector<HTMLInputElement>("#queueName");
  const queueTypeMessage =
    document.querySelector<HTMLElement>("#queueTypeMessage");
  const queueTypeList =
    document.querySelector<HTMLUListElement>("#queueTypeList");

  const ticketForm = document.querySelector<HTMLFormElement>("#ticketForm");
  const ticketQueue = document.querySelector<HTMLSelectElement>("#ticketQueue");
  const ticketPriority =
    document.querySelector<HTMLSelectElement>("#ticketPriority");
  const ticketMessage = document.querySelector<HTMLElement>("#ticketMessage");
  const ticketGroups = document.querySelector<HTMLElement>("#ticketGroups");

  const toast = document.querySelector<HTMLElement>("#toast");
  const dialog = document.querySelector<HTMLDialogElement>("#confirmDialog");
  const confirmTitle = document.querySelector<HTMLElement>("#confirmTitle");
  const confirmText = document.querySelector<HTMLElement>("#confirmText");
  const confirmOk = document.querySelector<HTMLButtonElement>("#confirmOk");
  const confirmCancel =
    document.querySelector<HTMLButtonElement>("#confirmCancel");

  if (
    !queueTypeForm ||
    !codeInput ||
    !nameInput ||
    !queueTypeList ||
    !ticketForm ||
    !ticketQueue ||
    !ticketPriority ||
    !ticketGroups
  ) {
    console.error("Elemen halaman admin tidak lengkap.");
    return;
  }

  // navbar
  const session = getSession();

  if (session) {
    if (userName) userName.textContent = session.firstName;
    if (userRole) userRole.textContent = session.role;
  }

  logoutButton?.addEventListener("click", logout);

  // toast & dialog
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

  function confirmAction(
    title: string,
    text: string,
    okLabel: string,
  ): Promise<boolean> {
    if (!dialog || !confirmOk || !confirmCancel) {
      return Promise.resolve(window.confirm(text));
    }

    if (confirmTitle) confirmTitle.textContent = title;
    if (confirmText) confirmText.textContent = text;
    confirmOk.textContent = okLabel;

    return new Promise<boolean>((resolve) => {
      const finish = (answer: boolean): void => {
        confirmOk.removeEventListener("click", onOk);
        confirmCancel.removeEventListener("click", onCancel);
        dialog.removeEventListener("cancel", onCancel);

        if (dialog.open) dialog.close();
        resolve(answer);
      };

      const onOk = (): void => finish(true);
      const onCancel = (): void => finish(false);

      confirmOk.addEventListener("click", onOk);
      confirmCancel.addEventListener("click", onCancel);
      dialog.addEventListener("cancel", onCancel); // tombol Esc

      dialog.showModal();
      confirmCancel.focus();
    });
  }

  // render
  let lastSignature = "";

  function renderQueueTypes(queues: QueueMaster[], tickets: Ticket[]): void {
    queueTypeList!.replaceChildren();

    if (queues.length === 0) {
      queueTypeList!.append(
        el("li", {
          class: "empty-state",
          text: "Belum ada jenis antrian. Tambahkan lewat form di atas.",
        }),
      );
      return;
    }

    queues.forEach((queue) => {
      const waiting = countWaiting(tickets, queue.code);

      const title = el("div", { class: "queue-title" }, [
        el("strong", { text: queue.name }),
        el("span", { class: "code-chip", text: queue.code }),
        queue.isActive
          ? ""
          : el("span", { class: "badge badge-off", text: "Nonaktif" }),
      ]);

      const info = el("div", { class: "queue-info" }, [
        title,
        el("span", { class: "queue-meta", text: `${waiting} menunggu` }),
      ]);

      const toggleButton = el("button", {
        class: "btn btn-ghost btn-sm",
        text: queue.isActive ? "Nonaktifkan" : "Aktifkan",
        attrs: {
          type: "button",
          "data-action": "toggle",
          "data-code": queue.code,
        },
      });

      const deleteButton = el("button", {
        class: "btn btn-danger btn-sm",
        text: "Hapus",
        attrs: {
          type: "button",
          "data-action": "delete",
          "data-code": queue.code,
        },
      });

      const actions = el("div", { class: "queue-actions" }, [
        toggleButton,
        deleteButton,
      ]);

      queueTypeList!.append(
        el(
          "li",
          { class: queue.isActive ? "queue-item" : "queue-item is-inactive" },
          [info, actions],
        ),
      );
    });
  }

  function renderTicketSelects(queues: QueueMaster[]): void {
    const selectedQueue = ticketQueue!.value;
    const selectedPriority = ticketPriority!.value || "normal";

    ticketQueue!.replaceChildren(
      el("option", { text: "Pilih jenis antrian", attrs: { value: "" } }),
    );

    // jenis nonaktif tidak ditampilkan, sehingga tidak bisa dipilih.
    queues
      .filter((queue) => queue.isActive)
      .forEach((queue) => {
        ticketQueue!.append(
          el("option", {
            text: `${queue.name} (${queue.code})`,
            attrs: { value: queue.code },
          }),
        );
      });

    const stillAvailable = Array.from(ticketQueue!.options).some(
      (option) => option.value === selectedQueue,
    );
    ticketQueue!.value = stillAvailable ? selectedQueue : "";

    ticketPriority!.replaceChildren(
      ...PRIORITY_OPTIONS.map((priority) =>
        el("option", {
          text: PRIORITY_LABEL[priority],
          attrs: { value: priority },
        }),
      ),
    );
    ticketPriority!.value = selectedPriority;
  }

  function renderTicketGroups(queues: QueueMaster[], tickets: Ticket[]): void {
    ticketGroups!.replaceChildren();

    if (queues.length === 0) {
      ticketGroups!.append(
        el("p", { class: "empty-state", text: "Belum ada tiket." }),
      );
      return;
    }

    queues.forEach((queue) => {
      const queueTickets = tickets
        .filter((ticket) => ticket.queueType === queue.code)
        .reverse(); // tiket terbaru di atas

      const group = el("section", { class: "ticket-group" }, [
        el("h4", { text: queue.name }),
      ]);

      if (queueTickets.length === 0) {
        group.append(
          el("p", { class: "queue-meta", text: "Belum ada tiket." }),
        );
      }

      queueTickets.forEach((ticket) => {
        group.append(
          el("div", { class: "ticket-row" }, [
            el("strong", { class: "ticket-number", text: ticket.queueNumber }),
            el("span", {
              class: `badge badge-${ticket.priority}`,
              text: PRIORITY_LABEL[ticket.priority] ?? ticket.priority,
            }),
            el("span", {
              class: `badge status-${ticket.status}`,
              text: STATUS_LABEL[ticket.status] ?? ticket.status,
            }),
          ]),
        );
      });

      ticketGroups!.append(group);
    });
  }

  // render ulang hanya jika data berubah
  function render(force = false): void {
    const queues = getQueueMaster();
    const tickets = getTickets();
    const signature = JSON.stringify([queues, tickets]);

    if (!force && signature === lastSignature) return;
    lastSignature = signature;

    renderQueueTypes(queues, tickets);
    renderTicketSelects(queues);
    renderTicketGroups(queues, tickets);
  }

  // CRUD jenis antrian
  codeInput.addEventListener("input", () => {
    codeInput.value = codeInput.value.toUpperCase();
  });

  queueTypeForm.addEventListener("submit", (event: SubmitEvent) => {
    event.preventDefault();

    const result = addQueueType(codeInput.value, nameInput.value);

    if (!result.ok) {
      setMessage(queueTypeMessage, result.error, "error");
      return;
    }

    setMessage(
      queueTypeMessage,
      `Jenis antrian ${result.data.name} (${result.data.code}) berhasil ditambahkan.`,
      "success",
    );

    queueTypeForm.reset();
    codeInput.focus();
    render(true);
  });

  queueTypeList.addEventListener("click", async (event: MouseEvent) => {
    const target = (event.target as HTMLElement).closest<HTMLButtonElement>(
      "button[data-action]",
    );

    if (!target) return;

    const code = target.dataset.code ?? "";
    const action = target.dataset.action;
    const queue = getQueueMaster().find((item) => item.code === code);

    if (!queue) return;

    if (action === "toggle") {
      const result = toggleQueueType(code);

      if (result.ok) {
        showToast(
          `${result.data.name} ${result.data.isActive ? "diaktifkan" : "dinonaktifkan"}.`,
        );
      }
    }

    if (action === "delete") {
      const total = getTickets().filter((t) => t.queueType === code).length;
      const extra =
        total > 0 ? ` ${total} tiket di dalamnya ikut terhapus.` : "";

      const agreed = await confirmAction(
        "Hapus jenis antrian?",
        `${queue.name} (${queue.code}) akan dihapus.${extra}`,
        "Hapus",
      );

      if (!agreed) return;

      const result = deleteQueueType(code);

      if (result.ok) showToast(`${result.data.name} dihapus.`);
    }

    render(true);
  });

  // tiket manual
  ticketForm.addEventListener("submit", (event: SubmitEvent) => {
    event.preventDefault();

    const code = ticketQueue.value;
    const priority = ticketPriority.value;

    if (!code) {
      setMessage(
        ticketMessage,
        "Pilih jenis antrian terlebih dahulu.",
        "error",
      );
      return;
    }

    if (!isPriority(priority)) {
      setMessage(ticketMessage, "Tingkat prioritas tidak valid.", "error");
      return;
    }

    const result = issueTicket(code, priority);

    if (!result.ok) {
      setMessage(ticketMessage, result.error, "error");
      render(true);
      return;
    }

    setMessage(
      ticketMessage,
      `Tiket ${result.data.queueNumber} (${PRIORITY_LABEL[priority]}) berhasil diterbitkan.`,
      "success",
    );

    render(true);
  });

  // reset antrian
  resetButton?.addEventListener("click", async () => {
    const agreed = await confirmAction(
      "Reset antrian?",
      "Semua tiket aktif akan dihapus dan penomoran kembali ke 001. Jenis antrian tidak ikut terhapus.",
      "Reset",
    );

    if (!agreed) return;

    resetQueues();
    setMessage(ticketMessage, "", "");
    showToast("Antrian direset. Penomoran mulai dari 001.");
    render(true);
  });

  // operator bisa mengubah status tiket dari tab lain
  window.addEventListener("storage", () => render());
  window.setInterval(() => render(), 3000);

  render(true);
}
