import { requireAuth } from "./guards.js";
import { getSession, getQueueMaster, getTickets } from "./storage.js";
import { logout } from "./auth.js";
import { PRIORITY_LABEL, STATUS_LABEL, countWaiting, speakTicket, warmUpSpeech, } from "./queue-service.js";
import { el, formatClock } from "./dom.js";
// Auth Guard (revisi 13 Okt 2026): layar bersifat protected, wajib login.
// Semua role yang login (admin/moderator/user) boleh membuka halaman ini.
if (requireAuth()) {
    initScreenPage();
}
function queueNameOf(queues, code) {
    return queues.find((queue) => queue.code === code)?.name ?? code;
}
function initScreenPage() {
    const session = getSession();
    const userName = document.querySelector("#userName");
    const userRole = document.querySelector("#userRole");
    const logoutButton = document.querySelector("#logoutButton");
    const grid = document.querySelector("#screenGrid");
    const table = document.querySelector("#screenTable");
    const lastUpdated = document.querySelector("#lastUpdated");
    const fullscreenButton = document.querySelector("#fullscreenButton");
    const soundButton = document.querySelector("#soundButton");
    if (session) {
        if (userName)
            userName.textContent = session.firstName;
        if (userRole)
            userRole.textContent = session.role;
    }
    logoutButton?.addEventListener("click", logout);
    // Siapkan suara sejak interaksi pertama agar panggilan perdana bersuara.
    window.addEventListener("pointerdown", warmUpSpeech, { once: true });
    let soundOn = true;
    let lastSpokenId = null;
    function renderCards(queues, tickets) {
        if (!grid)
            return;
        grid.replaceChildren();
        const active = queues.filter((queue) => queue.isActive);
        if (active.length === 0) {
            grid.append(el("p", {
                class: "empty-state",
                text: "Belum ada layanan aktif. Silakan hubungi petugas.",
            }));
            return;
        }
        active.forEach((queue) => {
            const called = [...tickets]
                .reverse()
                .find((ticket) => ticket.queueType === queue.code && ticket.status === "dipanggil");
            const waiting = countWaiting(tickets, queue.code);
            const card = el("article", { class: "menu-card" }, [
                el("h3", { text: queue.name }),
                el("p", { text: "Nomor dipanggil" }),
                el("h2", { text: called ? called.queueNumber : "-" }),
                el("p", {
                    text: called
                        ? `Prioritas ${PRIORITY_LABEL[called.priority]}`
                        : "Menunggu panggilan",
                }),
                el("p", { text: `${waiting} antrean tersisa` }),
            ]);
            grid.append(card);
        });
    }
    function renderTable(queues, tickets) {
        if (!table)
            return;
        table.replaceChildren();
        const visible = tickets.filter((ticket) => ticket.status === "menunggu" || ticket.status === "dipanggil");
        if (visible.length === 0) {
            table.append(el("tr", {}, [
                el("td", { text: "Belum ada antrean aktif.", attrs: { colspan: "4" } }),
            ]));
            return;
        }
        visible
            .sort((a, b) => {
            if (a.status === "dipanggil" && b.status !== "dipanggil")
                return -1;
            if (b.status === "dipanggil" && a.status !== "dipanggil")
                return 1;
            return a.createdAt.localeCompare(b.createdAt);
        })
            .slice(0, 30)
            .forEach((ticket) => {
            table.append(el("tr", {}, [
                el("td", {}, [el("strong", { text: ticket.queueNumber })]),
                el("td", { text: queueNameOf(queues, ticket.queueType) }),
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
            ]));
        });
    }
    function announceNewCall(tickets, queues) {
        const current = [...tickets]
            .reverse()
            .find((ticket) => ticket.status === "dipanggil");
        if (!current || current.id === lastSpokenId)
            return;
        lastSpokenId = current.id;
        if (soundOn) {
            speakTicket(current, queueNameOf(queues, current.queueType));
        }
    }
    function renderScreen() {
        const queues = getQueueMaster();
        const tickets = getTickets();
        renderCards(queues, tickets);
        renderTable(queues, tickets);
        announceNewCall(tickets, queues);
        if (lastUpdated)
            lastUpdated.textContent = `Diperbarui ${formatClock()}`;
    }
    function updateFullscreenLabel() {
        if (!fullscreenButton)
            return;
        fullscreenButton.textContent = document.fullscreenElement
            ? "Keluar Layar Penuh"
            : "Layar Penuh";
    }
    fullscreenButton?.addEventListener("click", async () => {
        try {
            if (document.fullscreenElement) {
                await document.exitFullscreen();
            }
            else {
                await document.documentElement.requestFullscreen();
            }
        }
        catch (error) {
            console.error("Gagal mengubah layar penuh:", error);
        }
        finally {
            updateFullscreenLabel();
        }
    });
    document.addEventListener("fullscreenchange", updateFullscreenLabel);
    soundButton?.addEventListener("click", () => {
        soundOn = !soundOn;
        soundButton.textContent = soundOn ? "Suara: Aktif" : "Suara: Mati";
        soundButton.setAttribute("aria-pressed", String(soundOn));
    });
    renderScreen();
    // Pembaruan otomatis tanpa reload: event antar-tab + polling 2,5 detik.
    window.addEventListener("storage", renderScreen);
    window.setInterval(renderScreen, 2500);
}
