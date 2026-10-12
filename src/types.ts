export type UserRole = "admin" | "moderator" | "user";

// jenis antrian bersifat dinamis karena admin dapat menambah/menghapusnya, jadi bukan union tetap
export type QueueCode = string;

/** @deprecated Gunakan QueueCode. Dipertahankan agar queue.ts & screen.ts tetap kompatibel. */
export type QueueType = QueueCode;

export type QueuePriority = "normal" | "lansia" | "disabilitas" | "vip";

export type TicketStatus =
  | "menunggu"
  | "dipanggil"
  | "selesai"
  | "dibatalkan"
  | "dilewati";

export interface UserSession {
  token: string;
  userId: number;
  username: string;
  firstName: string;
  role: UserRole;
}

export interface QueueMaster {
  code: QueueCode;
  name: string;
  isActive: boolean;
}

export interface Ticket {
  id: string;
  queueNumber: string;
  queueType: QueueCode;
  patientName?: string;
  priority: QueuePriority;
  status: TicketStatus;
  createdAt: string;
}

export interface LoginResponse {
  accessToken: string;
  id: number;
  username: string;
}

export interface UserDetailResponse {
  id: number;
  username: string;
  firstName: string;
  role: UserRole;
}

export interface ActiveQueue {
  queueType: QueueType;
  currentTicket: Ticket | null;
  remainingCount: number;
}

export interface QueueCounter {
  queueCode: QueueCode;
  lastNumber: number;
}

// penyimpanan counter nomor terakhir per kode jenis antrian: { A: 3, B: 12 }
export type QueueCounterMap = Record<QueueCode, number>;

export interface QueueSummary {
  total: number;
  waiting: number;
  called: number;
  completed: number;
  skipped: number;
  cancelled: number;
}
