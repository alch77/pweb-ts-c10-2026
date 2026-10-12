import { getTickets, saveTickets } from "./storage.js";
const form = document.querySelector("#publicQueueForm");
const patientInput = document.querySelector("#patientName");
const queueTypeInput = document.querySelector("#queueType");
const message = document.querySelector("#queueMessage");
const ticketResult = document.querySelector("#ticketResult");
const ticketNumber = document.querySelector("#ticketNumber");
const lastTicketKey = "lastPublicTicketId";
// Tampilkan kembali tiket terakhir saat halaman dibuka
function showLastTicket() {
    if (!ticketResult || !ticketNumber)
        return;
    const lastTicketId = localStorage.getItem(lastTicketKey);
    if (!lastTicketId) {
        ticketResult.hidden = true;
        return;
    }
    const tickets = getTickets();
    const lastTicket = tickets.find((ticket) => ticket.id === lastTicketId);
    if (!lastTicket) {
        ticketResult.hidden = true;
        return;
    }
    ticketNumber.textContent = lastTicket.queueNumber;
    ticketResult.hidden = false;
}
showLastTicket();
if (form &&
    patientInput &&
    queueTypeInput &&
    message &&
    ticketResult &&
    ticketNumber) {
    form.addEventListener("submit", (event) => {
        event.preventDefault();
        const patientName = patientInput.value.trim();
        const queueType = queueTypeInput.value;
        message.textContent = "";
        if (!patientName) {
            message.textContent = "Nama pasien wajib diisi.";
            return;
        }
        const tickets = getTickets();
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
        const todayTickets = tickets.filter((ticket) => ticket.queueNumber.startsWith(todayPrefix));
        const number = `${todayPrefix}-${String(todayTickets.length + 1).padStart(3, "0")}`;
        const ticket = {
            id: crypto.randomUUID(),
            queueNumber: number,
            queueType,
            patientName,
            status: "menunggu",
            createdAt: new Date().toISOString(),
        };
        tickets.push(ticket);
        saveTickets(tickets);
        localStorage.setItem(lastTicketKey, ticket.id);
        ticketNumber.textContent = number;
        ticketResult.hidden = false;
        message.textContent = "Nomor antrean berhasil dibuat.";
        form.reset();
    });
}
