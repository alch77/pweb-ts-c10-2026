
import { requireRole } from "./guards.js";
import { getSession } from "./storage.js";
import { logout } from "./auth.js";

if (requireRole(["admin"])) {
  const session = getSession();

  const welcome =
    document.querySelector<HTMLElement>("#adminWelcome");

  const logoutButton =
    document.querySelector<HTMLButtonElement>("#logoutButton");

  if (welcome && session) {
    welcome.textContent =
      `Selamat datang, ${session.firstName}!`;
  }

  logoutButton?.addEventListener("click", logout);
}
