import { getSession } from "./storage.js";

/**
 * Mengisi tautan #staffLink di navbar halaman publik:
 * - belum login        -> "Masuk Staf" (login.html)
 * - admin / moderator  -> "Dashboard"  (index.html)
 * - user biasa         -> "Operator"   (operator.html)
 */
export function setupStaffLink(): void {
  const link = document.querySelector<HTMLAnchorElement>("#staffLink");

  if (!link) return;

  const session = getSession();

  if (!session || !session.token) {
    link.textContent = "Masuk Staf";
    link.href = "login.html";
    return;
  }

  if (session.role === "user") {
    link.textContent = "Operator";
    link.href = "operator.html";
  } else {
    link.textContent = "Dashboard";
    link.href = "index.html";
  }
}

setupStaffLink();
