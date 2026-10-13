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

// Urutan prioritas: VIP / Disabilitas / Lansia didahulukan atas Normal.
// Nilai lebih kecil = dipanggil lebih dulu.
export const PRIORITY_RANK: Record<QueuePriority, number> = {
  vip: 0,
  disabilitas: 1,
  lansia: 2,
  normal: 3,
};

export function compareTicketsByPriority(a: Ticket, b: Ticket): number {
  const rank = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];

  if (rank !== 0) return rank;

  return a.createdAt.localeCompare(b.createdAt);
}

/** Tiket menunggu terurut prioritas (VIP > Disabilitas > Lansia > Normal, lalu FIFO). */
export function getWaitingSorted(tickets: Ticket[]): Ticket[] {
  return tickets
    .filter((ticket) => ticket.status === "menunggu")
    .sort(compareTicketsByPriority);
}

/** Tiket berikutnya yang layak dipanggil (null bila antrean kosong). */
export function getNextTicket(tickets: Ticket[]): Ticket | null {
  return getWaitingSorted(tickets)[0] ?? null;
}

/** Tiket yang sedang dipanggil (ambil yang terbaru bila data lama berisi >1). */
export function getCurrentCalled(tickets: Ticket[]): Ticket | null {
  return [...tickets].reverse().find((ticket) => ticket.status === "dipanggil") ?? null;
}

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

// CRUD jenis antrean
export function addQueueType(
  codeInput: string,
  nameInput: string,
): Result<QueueMaster> {
  const code = codeInput.trim();
  const name = normalizeName(nameInput);
  const queues = getQueueMaster();

  // Cek duplikasi dulu (tak bedakan kapital): "c" tetap bentrok dengan "C".
  const codeTaken =
    code.length > 0 &&
    queues.some(
      (queue) => queue.code.toUpperCase() === code.toUpperCase(),
    );

  if (codeTaken) {
    return fail(
      `Kode "${code.toUpperCase()}" sudah dipakai jenis antrean lain.`,
    );
  }

  const nameTaken =
    name.length > 0 &&
    queues.some(
      (queue) =>
        normalizeName(queue.name).toLowerCase() === name.toLowerCase(),
    );

  if (nameTaken) {
    return fail(`Nama "${name}" sudah dipakai jenis antrean lain.`);
  }

  if (!/^[A-Z]$/.test(code)) {
    return fail("Kode harus berupa 1 huruf kapital (A–Z).");
  }

  if (!name) {
    return fail("Nama layanan wajib diisi.");
  }

  if (name.length > 30) {
    return fail("Nama layanan maksimal 30 karakter.");
  }

  const created: QueueMaster = { code, name, isActive: true };

  saveQueueMaster([...queues, created]);

  return succeed(created);
}

export function toggleQueueType(code: QueueCode): Result<QueueMaster> {
  const queues = getQueueMaster();
  const target = queues.find((queue) => queue.code === code);

  if (!target) {
    return fail("Jenis antrean tidak ditemukan.");
  }

  target.isActive = !target.isActive;
  saveQueueMaster(queues);

  return succeed(target);
}

// hapus jenis antrean beserta tiket dan counter miliknya
export function deleteQueueType(code: QueueCode): Result<QueueMaster> {
  const queues = getQueueMaster();
  const target = queues.find((queue) => queue.code === code);

  if (!target) {
    return fail("Jenis antrean tidak ditemukan.");
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
    return fail("Jenis antrean tidak ditemukan.");
  }

  if (!queue.isActive) {
    return fail(`Jenis antrean ${queue.name} sedang nonaktif.`);
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

// ---- Aksi operator (dipanggil / dilewati / selesai) ----

/**
 * Panggil Berikutnya: tiket aktif sebelumnya menjadi Selesai,
 * lalu tiket menunggu teratas (urut prioritas) menjadi Dipanggil.
 */
export function callNextTicket(): Result<{ finished: Ticket | null; called: Ticket | null }> {
  const tickets = getTickets();
  const current = getCurrentCalled(tickets);

  let finished: Ticket | null = null;

  if (current) {
    current.status = "selesai";
    finished = { ...current };
  }

  const next = getNextTicket(tickets);

  if (next) {
    next.status = "dipanggil";
    saveTickets(tickets);
    return succeed({ finished, called: { ...next } });
  }

  saveTickets(tickets);

  if (!finished) {
    return fail("Tidak ada tiket menunggu untuk dipanggil.");
  }

  return succeed({ finished, called: null });
}

/**
 * Lewati: tiket aktif menjadi Dilewati, lalu otomatis memanggil
 * tiket menunggu berikutnya (jika ada).
 */
export function skipCurrentTicket(): Result<{ skipped: Ticket; called: Ticket | null }> {
  const tickets = getTickets();
  const current = getCurrentCalled(tickets);

  if (!current) {
    return fail("Tidak ada tiket yang sedang dipanggil.");
  }

  current.status = "dilewati";
  const skipped: Ticket = { ...current };

  const next = getNextTicket(tickets);

  if (next) {
    next.status = "dipanggil";
  }

  saveTickets(tickets);

  return succeed({ skipped, called: next ? { ...next } : null });
}

/** Selesai: menutup tiket aktif tanpa otomatis memanggil berikutnya. */
export function finishCurrentTicket(): Result<Ticket> {
  const tickets = getTickets();
  const current = getCurrentCalled(tickets);

  if (!current) {
    return fail("Tidak ada tiket yang sedang dipanggil.");
  }

  current.status = "selesai";
  saveTickets(tickets);

  return succeed({ ...current });
}

/** Respon suara panggilan antrean (Web Speech API, aman bila tak didukung). */
export function speakTicket(ticket: Ticket, queueName: string): void {
  try {
    if (!("speechSynthesis" in window)) return;

    const synth = window.speechSynthesis;
    // Hentikan antrean lama agar panggilan tak bertumpuk.
    synth.cancel();

    const spoken = ticket.queueNumber.replace("-", " ");
    const utterance = new SpeechSynthesisUtterance(
      `Nomor antrean ${spoken}. ${queueName}. Silakan menuju loket.`,
    );
    utterance.lang = "id-ID";
    utterance.rate = 0.95;

    // Pilih suara Indonesia bila tersedia, jika tidak pakai bawaan.
    const voice = synth
      .getVoices()
      .find((item) => item.lang.toLowerCase().startsWith("id"));

    if (voice) utterance.voice = voice;

    // Jeda setelah cancel: di Chrome, speak() yang dipanggil se-task
    // dengan cancel() ikut terhapus sehingga sunyi.
    window.setTimeout(() => {
      try {
        if (synth.paused) synth.resume();
        synth.speak(utterance);
      } catch {
        // Abaikan: audio hanya bonus, bukan alur utama.
      }
    }, 150);
  } catch {
    // Abaikan: audio hanya bonus, bukan alur utama.
  }
}

/** Pemanasan TTS sekali saat interaksi pertama (suara belum siap di klik awal). */
export function warmUpSpeech(): void {
  try {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.getVoices();
  } catch {
    // Abaikan.
  }
}
