import { saveSession, getSession, clearSession } from "./storage.js";
export function saveLoginSession(data) {
    saveSession(data);
}
export function logout() {
    clearSession();
    window.location.href = "login.html";
}
export function isAuthenticated() {
    return getSession() !== null;
}
export function hasRole(allowedRoles) {
    const session = getSession();
    return session !== null && allowedRoles.includes(session.role);
}
