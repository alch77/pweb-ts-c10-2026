import { getTickets } from "./storage.js";
const table = document.querySelector("#screenTable");
const currentNumber = {
    umum: "current-umum",
    gigi: "current-gigi",
    anak: "current-anak",
};
function renderScreen() {
    const tickets = getTickets();
    if (table) {
        table.replaceChildren();
        const visibleTickets = tickets.filter((ticket) => ticket.status === "menunggu" || ticket.status === "dipanggil");
        if (visibleTickets.length === 0) {
            const row = document.createElement("tr");
            const cell = document.createElement("td");
            cell.colSpan = 4;
            cell.textContent = "Belum ada antrean aktif.";
            cell.style.padding = "12px";
            row.appendChild(cell);
            table.appendChild(row);
        }
        else {
            visibleTickets.forEach((ticket) => {
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
                table.appendChild(row);
            });
        }
    }
    Object.keys(currentNumber).forEach((type) => {
        const element = document.getElementById(currentNumber[type]);
        if (!element)
            return;
        const calledTicket = [...tickets]
            .reverse()
            .find((ticket) => ticket.queueType === type && ticket.status === "dipanggil");
        element.textContent = calledTicket ? calledTicket.queueNumber : "-";
    });
}
renderScreen();
// perbarui tampilan jika antrean berubah di tab browser lain
window.addEventListener("storage", renderScreen);
// perbarui secara berkala
window.setInterval(renderScreen, 3000);
