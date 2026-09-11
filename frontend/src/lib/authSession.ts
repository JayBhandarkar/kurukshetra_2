"use client";

export interface UserSession {
  id?: string;
  email: string;
  fullName?: string;
  role?: string;
  isVerified: boolean;
}

const AUTH_STORAGE_KEY = "policylens_user_session";
const AUTH_COOKIE_KEY = "policylens_session";

function setCookie(name: string, value: string, days: number = 30) {
  if (typeof document === "undefined") return;
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}

function deleteCookie(name: string) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax`;
}

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  if (match) return decodeURIComponent(match[2]);
  return null;
}

export function getClientSession(): UserSession | null {
  if (typeof window === "undefined") return null;
  try {
    // 1. Check localStorage
    const rawLocal = localStorage.getItem(AUTH_STORAGE_KEY);
    if (rawLocal) {
      const parsed = JSON.parse(rawLocal);
      if (parsed?.email) return parsed;
    }

    // 2. Fallback to Cookie
    const rawCookie = getCookie(AUTH_COOKIE_KEY);
    if (rawCookie) {
      const parsed = JSON.parse(rawCookie);
      if (parsed?.email) {
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(parsed));
        return parsed;
      }
    }

    return null;
  } catch {
    return null;
  }
}

export function setClientSession(user: UserSession) {
  if (typeof window === "undefined") return;
  try {
    const serialized = JSON.stringify(user);
    localStorage.setItem(AUTH_STORAGE_KEY, serialized);
    setCookie(AUTH_COOKIE_KEY, serialized, 30);
    window.dispatchEvent(new Event("policylens_auth_change"));
  } catch (e) {
    console.error("Error setting session:", e);
  }
}

export function clearClientSession() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    deleteCookie(AUTH_COOKIE_KEY);
    window.dispatchEvent(new Event("policylens_auth_change"));
  } catch (e) {
    console.error("Error clearing session:", e);
  }
}
