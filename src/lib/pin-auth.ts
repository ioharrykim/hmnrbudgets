import { createHmac, timingSafeEqual } from "node:crypto";

import { PIN_SESSION_COOKIE } from "@/lib/constants";

type PinSessionPayload = {
  email: string;
  issuedAt: string;
  authMode: "pin";
};

function base64UrlEncode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signValue(unsignedValue: string, secret: string) {
  return createHmac("sha256", secret).update(unsignedValue).digest("base64url");
}

export function createPinSessionValue(email: string) {
  const secret = process.env.SESSION_SIGNING_SECRET;
  if (!secret) {
    throw new Error("SESSION_SIGNING_SECRET is not configured.");
  }

  const payload: PinSessionPayload = {
    email,
    issuedAt: new Date().toISOString(),
    authMode: "pin",
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = signValue(encodedPayload, secret);
  return `${encodedPayload}.${signature}`;
}

export function verifyPinSessionValue(value: string): PinSessionPayload | null {
  const secret = process.env.SESSION_SIGNING_SECRET;
  if (!secret) {
    return null;
  }

  const [encodedPayload, signature] = value.split(".");
  if (!encodedPayload || !signature) {
    return null;
  }

  const expectedSignature = signValue(encodedPayload, secret);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as PinSessionPayload;
    if (!payload.email || payload.authMode !== "pin") {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export function getPinSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  };
}

export { PIN_SESSION_COOKIE };
