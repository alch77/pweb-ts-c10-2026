import type {
  UserSession,
  Ticket,
  QueueMaster,
  QueueCounterMap,
} from "./types.js";

const SESSION_KEY = "user_session";
const QUEUE_KEY = "queue_types";
const TICKET_KEY = "queue_tickets";
const COUNTER_KEY = "queue_counters";

function readJSON<T>(key: string, fallback: T): T {
  const data = localStorage.getItem(key);

  if (!data) return fallback;

  try {
    return JSON.parse(data) as T;
  } catch {
    return fallback;
  }
}

function writeJSON(key: string, value: unknown): void {
  localStorage.setItem(key, JSON.stringify(value));
}

// sesi pengguna
export function saveSession(session: UserSession): void {
  writeJSON(SESSION_KEY, session);
}

export function getSession(): UserSession | null {
  return readJSON<UserSession | null>(SESSION_KEY, null);
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
}

// data awal. Kode C sengaja dikosongkan: spek & panduan uji memakai
// C sebagai contoh jenis antrean baru, jadi harus bebas di data awal.
const DEFAULT_QUEUES: QueueMaster[] = [
  { code: "A", name: "UMUM-1", isActive: true },
  { code: "B", name: "UMUM-2", isActive: true },
  { code: "G", name: "GIGI", isActive: true },
  { code: "F", name: "FARMASI", isActive: true },
  { code: "P", name: "PSIKOLOG", isActive: true },
];

export function saveQueueMaster(queues: QueueMaster[]): void {
  writeJSON(QUEUE_KEY, queues);
}

export function getQueueMaster(): QueueMaster[] {
  if (localStorage.getItem(QUEUE_KEY) === null) {
    saveQueueMaster(DEFAULT_QUEUES);
    return DEFAULT_QUEUES.map((queue) => ({ ...queue }));
  }

  const data = readJSON<unknown>(QUEUE_KEY, []);

  if (!Array.isArray(data)) return [];

  return data.filter(
    (item): item is QueueMaster =>
      typeof item === "object" &&
      item !== null &&
      typeof (item as QueueMaster).code === "string" &&
      typeof (item as QueueMaster).name === "string",
  );
}

// tiket
export function saveTickets(tickets: Ticket[]): void {
  writeJSON(TICKET_KEY, tickets);
}

export function getTickets(): Ticket[] {
  const data = readJSON<unknown>(TICKET_KEY, []);

  return Array.isArray(data) ? (data as Ticket[]) : [];
}

// counter nomor tiket per jenis antrean
export function saveCounters(counters: QueueCounterMap): void {
  writeJSON(COUNTER_KEY, counters);
}

export function getCounters(): QueueCounterMap {
  const data = readJSON<unknown>(COUNTER_KEY, {});

  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    return {};
  }

  return data as QueueCounterMap;
}
