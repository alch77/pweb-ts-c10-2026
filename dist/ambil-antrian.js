import { getQueueMaster, getTickets } from "./storage.js";
import { LAST_TICKET_KEY, PRIORITY_LABEL, STATUS_LABEL, countWaiting, issueTicket, } from "./queue-service.js";
import { el, formatClock, setMessage } from "./dom.js";
const serviceGrid = document.querySelector("#serviceGrid");
const takeMessage = document.querySelector("#takeMessage");
const lastUpdated = document.querySelector("#lastUpdated");
const ticketResult = document.querySelector("#ticketResult");
const ticketNumber = document.querySelector("#ticketNumber");
const ticketDetail = document.querySelector("#ticketDetail");
const ticketStatus = document.querySelector("#ticketStatus");
const ticketHint = document.querySelector("#ticketHint");
const ticketDismiss = document.querySelector("#ticketDismiss");
// prioritas yang boleh dipilih lewat menu "Ambil dengan prioritas"
const EXTRA_PRIORITIES = ["lansia", "disabilitas", "vip"];
let renderedSignature = "";
let cooldown = false;
const waitingLabels = new Map();
// kartu yang prioritasnya sedang dipertahankan saat render ulang
const openMenus = new Set();
// kartu jenis antrian
function createCard(queue) {
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
    const card = el("article", { class: queue.isActive ? "service-card" : "service-card is-disabled" }, [
        el("header", { class: "service-card-head" }, [
            el("h3", { text: queue.name }),
            el("span", { class: "code-chip", text: queue.code }),
        ]),
    ]);
    if (!queue.isActive) {
        takeButton.disabled = true;
        card.append(takeButton, el("p", {
            class: "queue-meta",
            text: "Layanan ini sedang tidak tersedia.",
        }));
        return card;
    }
    const priorityButtons = EXTRA_PRIORITIES.map((priority) => el("button", {
        class: "btn btn-ghost btn-sm",
        text: PRIORITY_LABEL[priority],
        attrs: {
            type: "button",
            "data-code": queue.code,
            "data-priority": priority,
        },
    }));
    const menu = el("details", { class: "priority-menu" }, [
        el("summary", { text: "Ambil dengan prioritas" }),
        el("div", { class: "priority-actions" }, priorityButtons),
    ]);
    menu.open = openMenus.has(queue.code);
    menu.addEventListener("toggle", () => {
        if (menu.open)
            openMenus.add(queue.code);
        else
            openMenus.delete(queue.code);
    });
    card.append(takeButton, menu, waiting);
    return card;
}
function renderCards(queues) {
    if (!serviceGrid)
        return;
    waitingLabels.clear();
    serviceGrid.replaceChildren();
    if (queues.length === 0) {
        serviceGrid.append(el("p", {
            class: "empty-state",
            text: "Belum ada jenis antrian. Silakan hubungi petugas.",
        }));
        return;
    }
    queues.forEach((queue) => serviceGrid.append(createCard(queue)));
}
// tiket terakhir
function renderLastTicket() {
    if (!ticketResult || !ticketNumber)
        return;
    const lastId = localStorage.getItem(LAST_TICKET_KEY);
    const ticket = lastId
        ? getTickets().find((item) => item.id === lastId)
        : undefined;
    if (!ticket) {
        ticketResult.hidden = true;
        return;
    }
    const queue = getQueueMaster().find((item) => item.code === ticket.queueType);
    ticketNumber.textContent = ticket.queueNumber;
    if (ticketDetail) {
        ticketDetail.textContent = `${queue?.name ?? ticket.queueType} · Prioritas ${PRIORITY_LABEL[ticket.priority] ?? ticket.priority}`;
    }
    if (ticketStatus) {
        ticketStatus.textContent = STATUS_LABEL[ticket.status] ?? ticket.status;
        ticketStatus.className = `badge status-${ticket.status}`;
    }
    if (ticketHint) {
        const hints = {
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
function refresh() {
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
    if (lastUpdated)
        lastUpdated.textContent = formatClock();
}
// ambil tiket
serviceGrid?.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-code]");
    if (!button || button.disabled || cooldown)
        return;
    cooldown = true;
    window.setTimeout(() => {
        cooldown = false;
    }, 700);
    const code = button.dataset.code ?? "";
    const priority = (button.dataset.priority ?? "normal");
    const result = issueTicket(code, priority);
    if (!result.ok) {
        setMessage(takeMessage, result.error, "error");
        refresh();
        return;
    }
    localStorage.setItem(LAST_TICKET_KEY, result.data.id);
    setMessage(takeMessage, `Nomor antrean ${result.data.queueNumber} berhasil dibuat.`, "success");
    refresh();
    ticketResult?.scrollIntoView({ behavior: "smooth", block: "nearest" });
});
ticketDismiss?.addEventListener("click", () => {
    localStorage.removeItem(LAST_TICKET_KEY);
    setMessage(takeMessage, "", "");
    renderLastTicket();
});
// jenis antrian baru dari dashboard admin (muncul otomatis)
window.addEventListener("storage", refresh);
window.setInterval(refresh, 2500);
refresh();
