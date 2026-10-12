import {
  getQueueMaster,
  saveQueueMaster,
  getTickets,
  saveTickets,
  getCounters,
  saveCounters,
} from "./storage.js";
import type {
  QueueCode,
  QueueMaster,
  QueuePriority,
  Ticket,
  TicketStatus,
} from "./types.js";

export const LAST_TICKET_KEY = "lastPublicTicketId";

export const PRIORITY_OPTIONS: QueuePriority[] = [
  "normal",
  "lansia",
  "disabilitas",
  "vip",
];

export const PRIORITY_LABEL: Record<QueuePriority, string> = {
  normal: "Normal",
  lansia: "Lansia",
  disabilitas: "Disabilitas",
  vip: "VIP",
};

export const STATUS_LABEL: Record<TicketStatus, string> = {
  menunggu: "Menunggu",
  dipanggil: "Dipanggil",
  selesai: "Selesai",
  dibatalkan: "Dibatalkan",
  dilewati: "Dilewati",
};

// hasil operasi: sukses membawa data, gagal membawa pesan error
export type Result<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

function fail<T = void>(error: string): Result<T> {
  return { ok: false, error };
}

function succeed<T>(data: T): Result<T> {
  return { ok: true, data };
}

export function isPriority(value: string): value is QueuePriority {
  return (PRIORITY_OPTIONS as string[]).includes(value);
}

function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

// format nomor tiket huruf-angka: "A-001"
export function formatQueueNumber(code: QueueCode, number: number): string {
  return `${code}-${String(number).padStart(3, "0")}`;
}

export function countWaiting(tickets: Ticket[], code: QueueCode): number {
  return tickets.filter(
    (ticket) => ticket.queueType === code && ticket.status === "menunggu",
  ).length;
}

function createId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

// CRUD jenis antrian
export function addQueueType(
  codeInput: string,
  nameInput: string,
): Result<QueueMaster> {
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
  const codeTaken = queues.some(
    (queue) => queue.code.toUpperCase() === code.toUpperCase(),
  );

  if (codeTaken) {
    return fail(`Kode "${code}" sudah dipakai jenis antrian lain.`);
  }

  const nameTaken = queues.some(
    (queue) => normalizeName(queue.name).toLowerCase() === name.toLowerCase(),
  );

  if (nameTaken) {
    return fail(`Nama "${name}" sudah dipakai jenis antrian lain.`);
  }

  const created: QueueMaster = { code, name, isActive: true };

  saveQueueMaster([...queues, created]);

  return succeed(created);
}

export function toggleQueueType(code: QueueCode): Result<QueueMaster> {
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
export function deleteQueueType(code: QueueCode): Result<QueueMaster> {
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
export function resetQueues(): void {
  saveTickets([]);
  saveCounters({});
  localStorage.removeItem(LAST_TICKET_KEY);
}

// penerbitan tiket (dipakai admin & pengunjung)
export function issueTicket(
  code: QueueCode,
  priority: QueuePriority,
): Result<Ticket> {
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

  const ticket: Ticket = {
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
