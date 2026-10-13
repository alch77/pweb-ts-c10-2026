import { getSession } from "./storage.js";
export function requireAuth() {
    const session = getSession();
    if (!session || !session.token) {
        window.location.replace("login.html");
        return false;
    }
    return true;
}
export function requireRole(allowedRoles) {
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
