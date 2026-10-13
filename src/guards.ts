
import { getSession } from "./storage.js";
import type { UserRole } from "./types.js";

export function requireAuth(): boolean {
  const session = getSession();

  if (!session || !session.token) {
    window.location.replace("login.html");
    return false;
  }

  return true;
}

export function requireRole(allowedRoles: UserRole[]): boolean {
  const session = getSession();

  if (!session || !session.token) {
    window.location.replace("login.html");
    return false;
  }

  // Spek: belum login ATAU role tidak diizinkan -> paksa ke login.html.
  if (!allowedRoles.includes(session.role)) {
    window.location.replace("login.html");
    return false;
  }

  return true;
}
