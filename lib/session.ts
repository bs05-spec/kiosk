import { cookies } from "next/headers";
import crypto from "crypto";

export const ADMIN_COOKIE_NAME = "attend_admin_session";
export const KIOSK_SELECTION_COOKIE_NAME = "attend_kiosk_selection";

function getSessionSecret() {
  return process.env.ADMIN_SESSION_SECRET || "development-session-secret";
}

export function signValue(value: string) {
  const hash = crypto
    .createHmac("sha256", getSessionSecret())
    .update(value)
    .digest("hex")
    .slice(0, 32);

  return `${value}.${hash}`;
}

export function verifySignedValue(value: string | undefined) {
  if (!value) {
    return null;
  }

  const parts = value.split(".");
  if (parts.length < 2) {
    return null;
  }

  const payload = parts.slice(0, -1).join(".");
  const expected = crypto
    .createHmac("sha256", getSessionSecret())
    .update(payload)
    .digest("hex")
    .slice(0, 32);

  if (parts[parts.length - 1] !== expected) {
    return null;
  }

  return payload;
}

export async function isAdminAuthenticated() {
  const cookieStore = await cookies();
  return cookieStore.get(ADMIN_COOKIE_NAME)?.value === "authenticated";
}

export async function setAdminSession() {
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_COOKIE_NAME, "authenticated", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
}

export async function clearAdminSession() {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_COOKIE_NAME);
}

export async function getSelectedRosterId() {
  const cookieStore = await cookies();
  const signed = cookieStore.get(KIOSK_SELECTION_COOKIE_NAME)?.value;
  return verifySignedValue(signed);
}

export async function setSelectedRosterId(rosterId: string) {
  const cookieStore = await cookies();
  const signed = signValue(rosterId);
  cookieStore.set(KIOSK_SELECTION_COOKIE_NAME, signed, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
}

export async function clearSelectedRosterId() {
  const cookieStore = await cookies();
  cookieStore.delete(KIOSK_SELECTION_COOKIE_NAME);
}
