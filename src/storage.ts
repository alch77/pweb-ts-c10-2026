
import type { UserSession, Ticket } from "./types.js";

const SESSION_KEY = "authSession";
const QUEUE_KEY = "queueMaster";
const TICKET_KEY = "ticketList";

export function saveSession(session: UserSession): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function getSession(): UserSession | null {
  const data = localStorage.getItem(SESSION_KEY);

  if (!data) return null;

  try {
    return JSON.parse(data) as UserSession;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
}

export function saveQueueMaster(queues: string[]): void {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queues));
}

export function getQueueMaster(): string[] {
  const data = localStorage.getItem(QUEUE_KEY);

  if (!data) return [];

  try {
    return JSON.parse(data) as string[];
  } catch {
    return [];
  }
}

export function saveTickets(tickets: Ticket[]): void {
  localStorage.setItem(TICKET_KEY, JSON.stringify(tickets));
}

export function getTickets(): Ticket[] {
  const data = localStorage.getItem(TICKET_KEY);

  if (!data) return [];

  try {
    return JSON.parse(data) as Ticket[];
  } catch {
    return [];
  }
}
