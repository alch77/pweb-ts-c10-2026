const SESSION_KEY = "authSession";
const QUEUE_KEY = "queueMaster";
const TICKET_KEY = "ticketList";
export function saveSession(session) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}
export function getSession() {
    const data = localStorage.getItem(SESSION_KEY);
    if (!data)
        return null;
    try {
        return JSON.parse(data);
    }
    catch {
        return null;
    }
}
export function clearSession() {
    localStorage.removeItem(SESSION_KEY);
}
export function saveQueueMaster(queues) {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queues));
}
export function getQueueMaster() {
    const data = localStorage.getItem(QUEUE_KEY);
    if (!data)
        return [];
    try {
        return JSON.parse(data);
    }
    catch {
        return [];
    }
}
export function saveTickets(tickets) {
    localStorage.setItem(TICKET_KEY, JSON.stringify(tickets));
}
export function getTickets() {
    const data = localStorage.getItem(TICKET_KEY);
    if (!data)
        return [];
    try {
        return JSON.parse(data);
    }
    catch {
        return [];
    }
}
