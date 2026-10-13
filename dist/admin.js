import { requireRole } from "./guards.js";
import { getSession, getQueueMaster, getTickets } from "./storage.js";
import { logout } from "./auth.js";
import { PRIORITY_LABEL, PRIORITY_OPTIONS, STATUS_LABEL, addQueueType, countWaiting, deleteQueueType, isPriority, issueTicket, resetQueues, toggleQueueType, } from "./queue-service.js";
import { el, setMessage } from "./dom.js";
// Auth Guard + Role Guard: hanya admin & moderator (hak akses disamakan)
if (requireRole(["admin", "moderator"])) {
    initAdminPage();
}
function initAdminPage() {
    const userName = document.querySelector("#userName");
    const userRole = document.querySelector("#userRole");
    const logoutButton = document.querySelector("#logoutButton");
    const resetButton = document.querySelector("#resetButton");
    const queueTypeForm = document.querySelector("#queueTypeForm");
    const codeInput = document.querySelector("#queueCode");
    const nameInput = document.querySelector("#queueName");
    const queueTypeMessage = document.querySelector("#queueTypeMessage");
    const queueTypeList = document.querySelector("#queueTypeList");
    const ticketForm = document.querySelector("#ticketForm");
    const ticketQueue = document.querySelector("#ticketQueue");
    const ticketPriority = document.querySelector("#ticketPriority");
    const ticketMessage = document.querySelector("#ticketMessage");
    const ticketGroups = document.querySelector("#ticketGroups");
    const toast = document.querySelector("#toast");
    const dialog = document.querySelector("#confirmDialog");
    const confirmTitle = document.querySelector("#confirmTitle");
    const confirmText = document.querySelector("#confirmText");
    const confirmOk = document.querySelector("#confirmOk");
    const confirmCancel = document.querySelector("#confirmCancel");
    if (!queueTypeForm ||
        !codeInput ||
        !nameInput ||
        !queueTypeList ||
        !ticketForm ||
        !ticketQueue ||
        !ticketPriority ||
        !ticketGroups) {
        console.error("Elemen halaman admin tidak lengkap.");
        return;
    }
    // navbar
    const session = getSession();
    if (session) {
        if (userName)
            userName.textContent = session.firstName;
        if (userRole)
            userRole.textContent = session.role;
    }
    logoutButton?.addEventListener("click", logout);
    // toast & dialog
    let toastTimer;
    function showToast(text) {
        if (!toast)
            return;
        toast.textContent = text;
        toast.hidden = false;
        window.clearTimeout(toastTimer);
        toastTimer = window.setTimeout(() => {
            toast.hidden = true;
        }, 3200);
    }
    function confirmAction(title, text, okLabel) {
        if (!dialog || !confirmOk || !confirmCancel) {
            return Promise.resolve(window.confirm(text));
        }
        if (confirmTitle)
            confirmTitle.textContent = title;
        if (confirmText)
            confirmText.textContent = text;
        confirmOk.textContent = okLabel;
        return new Promise((resolve) => {
            const finish = (answer) => {
                confirmOk.removeEventListener("click", onOk);
                confirmCancel.removeEventListener("click", onCancel);
                dialog.removeEventListener("cancel", onCancel);
                if (dialog.open)
                    dialog.close();
                resolve(answer);
            };
            const onOk = () => finish(true);
            const onCancel = () => finish(false);
            confirmOk.addEventListener("click", onOk);
            confirmCancel.addEventListener("click", onCancel);
            dialog.addEventListener("cancel", onCancel); // tombol Esc
            dialog.showModal();
            confirmCancel.focus();
        });
    }
    // render
    let lastSignature = "";
    function renderQueueTypes(queues, tickets) {
        queueTypeList.replaceChildren();
        if (queues.length === 0) {
            queueTypeList.append(el("li", {
                class: "empty-state",
                text: "Belum ada jenis antrean. Tambahkan lewat form di atas.",
            }));
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
            queueTypeList.append(el("li", { class: queue.isActive ? "queue-item" : "queue-item is-inactive" }, [info, actions]));
        });
    }
    function renderTicketSelects(queues) {
        const selectedQueue = ticketQueue.value;
        const selectedPriority = ticketPriority.value || "normal";
        ticketQueue.replaceChildren(el("option", { text: "Pilih jenis antrean", attrs: { value: "" } }));
        // jenis nonaktif tidak ditampilkan, sehingga tidak bisa dipilih.
        queues
            .filter((queue) => queue.isActive)
            .forEach((queue) => {
            ticketQueue.append(el("option", {
                text: `${queue.name} (${queue.code})`,
                attrs: { value: queue.code },
            }));
        });
        const stillAvailable = Array.from(ticketQueue.options).some((option) => option.value === selectedQueue);
        ticketQueue.value = stillAvailable ? selectedQueue : "";
        ticketPriority.replaceChildren(...PRIORITY_OPTIONS.map((priority) => el("option", {
            text: PRIORITY_LABEL[priority],
            attrs: { value: priority },
        })));
        ticketPriority.value = selectedPriority;
    }
    function renderTicketGroups(queues, tickets) {
        ticketGroups.replaceChildren();
        if (queues.length === 0) {
            ticketGroups.append(el("p", { class: "empty-state", text: "Belum ada tiket." }));
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
                group.append(el("p", { class: "queue-meta", text: "Belum ada tiket." }));
            }
            queueTickets.forEach((ticket) => {
                group.append(el("div", { class: "ticket-row" }, [
                    el("strong", { class: "ticket-number", text: ticket.queueNumber }),
                    el("span", {
                        class: `badge badge-${ticket.priority}`,
                        text: PRIORITY_LABEL[ticket.priority] ?? ticket.priority,
                    }),
                    el("span", {
                        class: `badge status-${ticket.status}`,
                        text: STATUS_LABEL[ticket.status] ?? ticket.status,
                    }),
                ]));
            });
            ticketGroups.append(group);
        });
    }
    // render ulang hanya jika data berubah
    function render(force = false) {
        const queues = getQueueMaster();
        const tickets = getTickets();
        const signature = JSON.stringify([queues, tickets]);
        if (!force && signature === lastSignature)
            return;
        lastSignature = signature;
        renderQueueTypes(queues, tickets);
        renderTicketSelects(queues);
        renderTicketGroups(queues, tickets);
        renderKpis(queues, tickets);
    }
    function renderKpis(queues, tickets) {
        const setKpi = (id, value) => {
            const target = document.getElementById(id);
            if (target)
                target.textContent = String(value);
        };
        setKpi("kpiActive", queues.filter((queue) => queue.isActive).length);
        setKpi("kpiWaiting", tickets.filter((ticket) => ticket.status === "menunggu").length);
        setKpi("kpiCalled", tickets.filter((ticket) => ticket.status === "dipanggil").length);
        setKpi("kpiDone", tickets.filter((ticket) => ticket.status === "selesai").length);
    }
    // CRUD jenis antrean
    codeInput.addEventListener("input", () => {
        codeInput.value = codeInput.value.toUpperCase();
    });
    queueTypeForm.addEventListener("submit", (event) => {
        event.preventDefault();
        const result = addQueueType(codeInput.value, nameInput.value);
        if (!result.ok) {
            setMessage(queueTypeMessage, result.error, "error");
            return;
        }
        setMessage(queueTypeMessage, `Jenis antrean ${result.data.name} (${result.data.code}) berhasil ditambahkan.`, "success");
        queueTypeForm.reset();
        codeInput.focus();
        render(true);
    });
    queueTypeList.addEventListener("click", async (event) => {
        const target = event.target.closest("button[data-action]");
        if (!target)
            return;
        const code = target.dataset.code ?? "";
        const action = target.dataset.action;
        const queue = getQueueMaster().find((item) => item.code === code);
        if (!queue)
            return;
        if (action === "toggle") {
            const result = toggleQueueType(code);
            if (result.ok) {
                showToast(`${result.data.name} ${result.data.isActive ? "diaktifkan" : "dinonaktifkan"}.`);
            }
        }
        if (action === "delete") {
            const total = getTickets().filter((t) => t.queueType === code).length;
            const extra = total > 0 ? ` ${total} tiket di dalamnya ikut terhapus.` : "";
            const agreed = await confirmAction("Hapus jenis antrean?", `${queue.name} (${queue.code}) akan dihapus.${extra}`, "Hapus");
            if (!agreed)
                return;
            const result = deleteQueueType(code);
            if (result.ok)
                showToast(`${result.data.name} dihapus.`);
        }
        render(true);
    });
    // tiket manual
    ticketForm.addEventListener("submit", (event) => {
        event.preventDefault();
        const code = ticketQueue.value;
        const priority = ticketPriority.value;
        if (!code) {
            setMessage(ticketMessage, "Pilih jenis antrean terlebih dahulu.", "error");
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
        setMessage(ticketMessage, `Tiket ${result.data.queueNumber} (${PRIORITY_LABEL[priority]}) berhasil diterbitkan.`, "success");
        render(true);
    });
    // reset antrean
    resetButton?.addEventListener("click", async () => {
        const agreed = await confirmAction("Reset antrean?", "Semua tiket aktif akan dihapus dan penomoran kembali ke 001. Jenis antrean tidak ikut terhapus.", "Reset");
        if (!agreed)
            return;
        resetQueues();
        setMessage(ticketMessage, "", "");
        showToast("Antrean direset. Penomoran mulai dari 001.");
        render(true);
    });
    // operator bisa mengubah status tiket dari tab lain
    window.addEventListener("storage", () => render());
    window.setInterval(() => render(), 3000);
    render(true);
}
