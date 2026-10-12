import { saveSession, clearSession } from "./storage.js";
import type { UserRole, UserSession } from "./types.js";

interface LoginResponse {
  accessToken: string;
  id: number;
  username: string;
}

interface UserDetailResponse {
  id: number;
  username: string;
  firstName: string;
  role: UserRole;
}

const form = document.querySelector<HTMLFormElement>("#loginForm");

const usernameInput = document.querySelector<HTMLInputElement>("#username");

const passwordInput = document.querySelector<HTMLInputElement>("#password");

const errorMessage =
  document.querySelector<HTMLParagraphElement>("#errorMessage");

const loginButton = document.querySelector<HTMLButtonElement>("#loginButton");

async function getUserDetail(userId: number): Promise<UserDetailResponse> {
  const response = await fetch(`https://dummyjson.com/users/${userId}`);

  if (!response.ok) {
    throw new Error("Gagal mengambil data pengguna.");
  }

  const user: UserDetailResponse = await response.json();

  if (
    user.role !== "admin" &&
    user.role !== "moderator" &&
    user.role !== "user"
  ) {
    throw new Error("Role pengguna tidak valid.");
  }

  return user;
}

if (form && usernameInput && passwordInput && errorMessage && loginButton) {
  form.addEventListener("submit", async (event: SubmitEvent) => {
    event.preventDefault();

    const username = usernameInput.value.trim();
    const password = passwordInput.value;

    errorMessage.textContent = "";

    if (!username || !password) {
      errorMessage.textContent = "Username dan password wajib diisi.";
      return;
    }

    loginButton.disabled = true;
    loginButton.textContent = "Memproses...";

    // hapus sesi sebelumnya agar tidak memakai data Emily
    clearSession();

    try {
      const response = await fetch("https://dummyjson.com/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username,
          password,
          expiresInMins: 30,
        }),
      });

      if (!response.ok) {
        throw new Error("Username atau password salah.");
      }

      const data: LoginResponse = await response.json();

      if (!data.accessToken || !data.id) {
        throw new Error("Data login tidak lengkap.");
      }

      // ambil detail pengguna sesuai ID hasil login
      const user = await getUserDetail(data.id);

      // pastikan detail pengguna sesuai dengan akun login
      if (user.id !== data.id || user.username !== data.username) {
        throw new Error("Data pengguna tidak sesuai dengan hasil login.");
      }

      const session: UserSession = {
        token: data.accessToken,
        userId: user.id,
        username: user.username,
        firstName: user.firstName,
        role: user.role,
      };

      saveSession(session);

      console.log("Pengguna login:", {
        userId: session.userId,
        username: session.username,
        firstName: session.firstName,
        role: session.role,
      });

      // Admin & moderator -> Dashboard Admin, user biasa -> Panel Operator
      if (session.role === "admin" || session.role === "moderator") {
        window.location.replace("index.html");
      } else {
        window.location.replace("operator.html");
      }
    } catch (error: unknown) {
      clearSession();

      errorMessage.textContent =
        error instanceof Error
          ? error.message
          : "Terjadi kesalahan. Silakan coba lagi.";

      console.error("Login gagal:", error);
    } finally {
      loginButton.disabled = false;
      loginButton.textContent = "Login";
    }
  });
}
