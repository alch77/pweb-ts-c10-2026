import { getSession } from "./storage.js";

/**
 * Mengisi tautan #staffLink di navbar halaman terproteksi:
 * - belum login        -> "Masuk Staf"   (login.html)
 * - admin / moderator  -> "Dashboard"    (index.html)
 * - user biasa         -> "Ambil Antrean" (ambil-antrean.html)
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

  // Admin/moderator dapat pintasan Dashboard; user biasa tidak perlu
  // (tujuan user — Ambil & Layar — sudah ada di navbar; menampilkan
  // "Ambil Antrean" ganda jika dipaksakan lewat staffLink).
  if (session.role === "user") {
    link.hidden = true;
  } else {
    link.textContent = "Dashboard";
    link.href = "index.html";
  }
}

setupStaffLink();
