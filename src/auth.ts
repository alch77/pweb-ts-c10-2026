
import type { UserSession } from "./types.js";
import { saveSession, getSession, clearSession } from "./storage.js";

export function saveLoginSession(data: UserSession): void {
  saveSession(data);
}

export function logout(): void {
  clearSession();
  window.location.href = "login.html";
}

export function isAuthenticated(): boolean {
  return getSession() !== null;
}

export function hasRole(
  allowedRoles: UserSession["role"][]
): boolean {
  const session = getSession();

  return session !== null && allowedRoles.includes(session.role);
}
