import { requireRole } from "./guards.js";
import { getSession } from "./storage.js";
import { logout } from "./auth.js";
const allowed = requireRole(["admin", "moderator"]);
if (allowed) {
    const session = getSession();
    const welcome = document.querySelector("#welcomeMessage");
    const logoutButton = document.querySelector("#logoutButton");
    if (welcome && session) {
        welcome.textContent = `Selamat datang, ${session.firstName}!`;
    }
    logoutButton?.addEventListener("click", () => {
        logout();
    });
}
