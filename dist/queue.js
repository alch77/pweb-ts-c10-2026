import { requireRole } from "./guards.js";
import { getSession, getTickets, saveTickets, } from "./storage.js";
import { logout } from "./auth.js";
if (requireRole(["user"])) {
    const session = getSession();
    const form = document.querySelector("#queueForm");
    const patientInput = document.querySelector("#patientName");
    const queueTypeInput = document.querySelector("#queueType");
    const message = document.querySelector("#queueMessage");
    const table = document.querySelector("#ticketTable");
    const welcome = document.querySelector("#welcomeMessage");
    const logoutButton = document.querySelector("#logoutButton");
    if (welcome && session) {
        welcome.textContent =
            `Selamat datang, ${session.firstName}!`;
    }
    logoutButton?.addEventListener("click", logout);
    function renderTickets() {
        if (!table)
            return;
        const tickets = getTickets();
        table.replaceChildren();
        if (tickets.length === 0) {
            const row = document.createElement("tr");
            const cell = document.createElement("td");
            cell.colSpan = 5;
            cell.textContent = "Belum ada antrean.";
            cell.style.padding = "12px";
            row.appendChild(cell);
            table.appendChild(row);
            return;
        }
        tickets.forEach((ticket) => {
            const row = document.createElement("tr");
            const values = [
                ticket.queueNumber,
                ticket.patientName ?? "-",
                ticket.queueType,
                ticket.status,
            ];
            values.forEach((value) => {
                const cell = document.createElement("td");
                cell.textContent = value;
                cell.style.padding = "12px";
                row.appendChild(cell);
            });
            const actionCell = document.createElement("td");
            actionCell.style.padding = "12px";
            const statusButton = document.createElement("button");
            statusButton.type = "button";
            if (ticket.status === "menunggu") {
                statusButton.textContent = "Panggil";
            }
            else if (ticket.status === "dipanggil") {
                statusButton.textContent = "Selesaikan";
            }
            else {
                statusButton.textContent = "Reset";
            }
            statusButton.addEventListener("click", () => {
                updateTicketStatus(ticket);
            });
            actionCell.appendChild(statusButton);
            row.appendChild(actionCell);
            table.appendChild(row);
        });
    }
    function updateTicketStatus(ticket) {
        const tickets = getTickets();
        const current = tickets.find((item) => item.id === ticket.id);
        if (!current)
            return;
        const nextStatus = {
            menunggu: "dipanggil",
            dipanggil: "selesai",
            selesai: "menunggu",
            dibatalkan: "menunggu",
            dilewati: "menunggu",
        };
        current.status = nextStatus[current.status];
        saveTickets(tickets);
        renderTickets();
    }
    form?.addEventListener("submit", (event) => {
        event.preventDefault();
        if (!patientInput || !queueTypeInput || !message) {
            return;
        }
        const patientName = patientInput.value.trim();
        const queueType = queueTypeInput.value;
        message.textContent = "";
        if (!patientName) {
            message.textContent = "Nama pasien wajib diisi.";
            return;
        }
        const prefix = {
            umum: "U",
            gigi: "G",
            anak: "A",
        };
        const date = new Date()
            .toISOString()
            .slice(0, 10)
            .replace(/-/g, "");
        const todayPrefix = `${prefix[queueType]}-${date}`;
        const tickets = getTickets();
        const todayTickets = tickets.filter((ticket) => ticket.queueNumber.startsWith(todayPrefix));
        const queueNumber = `${todayPrefix}-${String(todayTickets.length + 1).padStart(3, "0")}`;
        const newTicket = {
            id: crypto.randomUUID(),
            queueNumber,
            queueType,
            patientName,
            priority: "normal",
            status: "menunggu",
            createdAt: new Date().toISOString(),
        };
        tickets.push(newTicket);
        saveTickets(tickets);
        message.textContent =
            `Antrean berhasil ditambahkan: ${queueNumber}`;
        form.reset();
        renderTickets();
    });
    renderTickets();
}
