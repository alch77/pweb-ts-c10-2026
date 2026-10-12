
import { getSession } from "./storage.js";
import type { UserRole } from "./types.js";

function redirectByRole(): void {
  const session = getSession();

  if (!session || !session.token) {
    window.location.replace("login.html");
    return;
  }

  if (session.role === "user") {
    window.location.replace("operator.html");
  } else {
    window.location.replace("index.html");
  }
}

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

  if (!allowedRoles.includes(session.role)) {
    redirectByRole();
    return false;
  }

  return true;
}
