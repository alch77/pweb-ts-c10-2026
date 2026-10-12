import { getQueueMaster, saveQueueMaster, getTickets, saveTickets, getCounters, saveCounters, } from "./storage.js";
export const LAST_TICKET_KEY = "lastPublicTicketId";
export const PRIORITY_OPTIONS = [
    "normal",
    "lansia",
    "disabilitas",
    "vip",
];
export const PRIORITY_LABEL = {
    normal: "Normal",
    lansia: "Lansia",
    disabilitas: "Disabilitas",
    vip: "VIP",
};
export const STATUS_LABEL = {
    menunggu: "Menunggu",
    dipanggil: "Dipanggil",
    selesai: "Selesai",
    dibatalkan: "Dibatalkan",
    dilewati: "Dilewati",
};
function fail(error) {
    return { ok: false, error };
}
function succeed(data) {
    return { ok: true, data };
}
export function isPriority(value) {
    return PRIORITY_OPTIONS.includes(value);
}
function normalizeName(name) {
    return name.trim().replace(/\s+/g, " ");
}
// format nomor tiket huruf-angka: "A-001"
export function formatQueueNumber(code, number) {
    return `${code}-${String(number).padStart(3, "0")}`;
}
export function countWaiting(tickets, code) {
    return tickets.filter((ticket) => ticket.queueType === code && ticket.status === "menunggu").length;
}
function createId() {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
        return crypto.randomUUID();
    }
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
// CRUD jenis antrian
export function addQueueType(codeInput, nameInput) {
    const code = codeInput.trim();
    const name = normalizeName(nameInput);
    if (!/^[A-Z]$/.test(code)) {
        return fail("Kode harus berupa 1 huruf kapital (A–Z).");
    }
    if (!name) {
        return fail("Nama layanan wajib diisi.");
    }
    if (name.length > 30) {
        return fail("Nama layanan maksimal 30 karakter.");
    }
    const queues = getQueueMaster();
    // cek duplikasi, ga bedain huruf besar/kecil
    const codeTaken = queues.some((queue) => queue.code.toUpperCase() === code.toUpperCase());
    if (codeTaken) {
        return fail(`Kode "${code}" sudah dipakai jenis antrian lain.`);
    }
    const nameTaken = queues.some((queue) => normalizeName(queue.name).toLowerCase() === name.toLowerCase());
    if (nameTaken) {
        return fail(`Nama "${name}" sudah dipakai jenis antrian lain.`);
    }
    const created = { code, name, isActive: true };
    saveQueueMaster([...queues, created]);
    return succeed(created);
}
export function toggleQueueType(code) {
    const queues = getQueueMaster();
    const target = queues.find((queue) => queue.code === code);
    if (!target) {
        return fail("Jenis antrian tidak ditemukan.");
    }
    target.isActive = !target.isActive;
    saveQueueMaster(queues);
    return succeed(target);
}
// hapus jenis antrian beserta tiket dan counter miliknya
export function deleteQueueType(code) {
    const queues = getQueueMaster();
    const target = queues.find((queue) => queue.code === code);
    if (!target) {
        return fail("Jenis antrian tidak ditemukan.");
    }
    saveQueueMaster(queues.filter((queue) => queue.code !== code));
    saveTickets(getTickets().filter((ticket) => ticket.queueType !== code));
    const counters = getCounters();
    delete counters[code];
    saveCounters(counters);
    return succeed(target);
}
// reset tiket dan balikin penomoran ke 001
export function resetQueues() {
    saveTickets([]);
    saveCounters({});
    localStorage.removeItem(LAST_TICKET_KEY);
}
// penerbitan tiket (dipakai admin & pengunjung)
export function issueTicket(code, priority) {
    const queue = getQueueMaster().find((item) => item.code === code);
    if (!queue) {
        return fail("Jenis antrian tidak ditemukan.");
    }
    if (!queue.isActive) {
        return fail(`Jenis antrian ${queue.name} sedang nonaktif.`);
    }
    if (!isPriority(priority)) {
        return fail("Tingkat prioritas tidak valid.");
    }
    const tickets = getTickets();
    const counters = getCounters();
    // ambil angka tertinggi antara counter dan tiket yang ada biar ga bentrok
    const highestExisting = tickets
        .filter((ticket) => ticket.queueType === code)
        .reduce((highest, ticket) => {
        const value = Number(ticket.queueNumber.split("-").pop());
        return Number.isFinite(value) ? Math.max(highest, value) : highest;
    }, 0);
    const nextNumber = Math.max(counters[code] ?? 0, highestExisting) + 1;
    const ticket = {
        id: createId(),
        queueNumber: formatQueueNumber(code, nextNumber),
        queueType: code,
        priority,
        status: "menunggu",
        createdAt: new Date().toISOString(),
    };
    counters[code] = nextNumber;
    saveCounters(counters);
    saveTickets([...tickets, ticket]);
    return succeed(ticket);
}
