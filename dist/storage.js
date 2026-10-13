const SESSION_KEY = "authSession";
const QUEUE_KEY = "queueMaster";
const TICKET_KEY = "ticketList";
const COUNTER_KEY = "queueCounters";
function readJSON(key, fallback) {
    const data = localStorage.getItem(key);
    if (!data)
        return fallback;
    try {
        return JSON.parse(data);
    }
    catch {
        return fallback;
    }
}
function writeJSON(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
}
// sesi pengguna
export function saveSession(session) {
    writeJSON(SESSION_KEY, session);
}
export function getSession() {
    return readJSON(SESSION_KEY, null);
}
export function clearSession() {
    localStorage.removeItem(SESSION_KEY);
}
// data awal (sesuai contoh di soal)
const DEFAULT_QUEUES = [
    { code: "A", name: "UMUM-1", isActive: true },
    { code: "B", name: "UMUM-2", isActive: true },
    { code: "C", name: "UMUM-3", isActive: true },
    { code: "G", name: "GIGI", isActive: true },
    { code: "F", name: "FARMASI", isActive: true },
    { code: "P", name: "PSIKOLOG", isActive: true },
];
export function saveQueueMaster(queues) {
    writeJSON(QUEUE_KEY, queues);
}
export function getQueueMaster() {
    if (localStorage.getItem(QUEUE_KEY) === null) {
        saveQueueMaster(DEFAULT_QUEUES);
        return DEFAULT_QUEUES.map((queue) => ({ ...queue }));
    }
    const data = readJSON(QUEUE_KEY, []);
    if (!Array.isArray(data))
        return [];
    return data.filter((item) => typeof item === "object" &&
        item !== null &&
        typeof item.code === "string" &&
        typeof item.name === "string");
}
// tiket
export function saveTickets(tickets) {
    writeJSON(TICKET_KEY, tickets);
}
export function getTickets() {
    const data = readJSON(TICKET_KEY, []);
    return Array.isArray(data) ? data : [];
}
// counter nomor tiket per jenis antrean
export function saveCounters(counters) {
    writeJSON(COUNTER_KEY, counters);
}
export function getCounters() {
    const data = readJSON(COUNTER_KEY, {});
    if (typeof data !== "object" || data === null || Array.isArray(data)) {
        return {};
    }
    return data;
}
