
export type UserRole =
  | "admin"
  | "moderator"
  | "user";

export type QueueType =
  | "umum"
  | "gigi"
  | "anak";

export type QueuePriority =
  | "normal"
  | "lansia"
  | "disabilitas"
  | "vip";

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
  code: string;
  name: string;
  isActive: boolean;
}

export interface Ticket {
  id: string;
  queueNumber: string;
  queueType: QueueType;
  patientName: string;
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
  queueCode: string;
  lastNumber: number;
}

export interface QueueSummary {
  total: number;
  waiting: number;
  called: number;
  completed: number;
  skipped: number;
  cancelled: number;
}
