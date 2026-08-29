import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';

/**
 * No fallback, on purpose.
 *
 * This used to read `process.env.JWT_SECRET || 'fallback-secret-change-in-production'`, and this
 * repository is public — so anywhere the variable was missing, every visitor could sign a token
 * with a secret they could read on GitHub, `isAdmin: true` included. Production was fine when I
 * checked, but a preview deployment or a fresh environment without the variable would have been
 * silently forgeable, and nothing would have said so.
 *
 * Failing at startup is the point: a missing secret has to break the deploy, not weaken it. If a
 * build stops here, set JWT_SECRET for that environment (`openssl rand -base64 48`).
 */
const configuredSecret = process.env.JWT_SECRET;
if (!configuredSecret) {
  throw new Error(
    'JWT_SECRET není nastavený. Bez něj by se tokeny podepisovaly veřejně známým klíčem — ' +
    'nastav proměnnou v prostředí (např. `openssl rand -base64 48`).',
  );
}
const JWT_SECRET: string = configuredSecret;

export interface JWTPayload {
  userId: string;
  email: string;
  plan: string;
  isAdmin: boolean;
  isVip: boolean;
  accessExpiresAt?: string;
}

export function signToken(payload: JWTPayload): string {
  const expiresIn = payload.accessExpiresAt ? '1h' : '7d';
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

export function verifyToken(token: string): JWTPayload {
  const payload = jwt.verify(token, JWT_SECRET) as JWTPayload;
  if (payload.accessExpiresAt && new Date(payload.accessExpiresAt) < new Date()) {
    throw new Error('Access expired');
  }
  return payload;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function getCurrentUser(): Promise<JWTPayload | null> {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get('auth-token')?.value;
    if (!token) return null;
    return verifyToken(token);
  } catch {
    return null;
  }
}

/**
 * The session behind a request, or `null` when there is none.
 *
 * Deliberately does *not* throw on a bad token: the anonymous demo needs to tell "nobody is
 * signed in" apart from "something went wrong", and `verifyToken` throws for both a forged
 * signature and an expired one. Routes that require a user keep their own explicit 401.
 *
 * The existing 18 routes were left alone — they already read the cookie and check ownership with
 * `findFirst({ where: { id, userId } })`. Rewriting working authorisation code to funnel through
 * a helper is regression risk for no gain, so this is for new code only.
 */
export function sessionFrom(req: { cookies: { get(name: string): { value: string } | undefined } }): JWTPayload | null {
  try {
    const token = req.cookies.get('auth-token')?.value;
    if (!token) return null;
    return verifyToken(token);
  } catch {
    return null;
  }
}

export const PLAN_LIMITS = {
  FREE:     { searches: 5,        resultsPerSearch: 20 },
  PRO:      { searches: 100,      resultsPerSearch: 200 },
  BUSINESS: { searches: Infinity, resultsPerSearch: 500 },
  VIP:      { searches: Infinity, resultsPerSearch: 500 },
};

export function getPlanLimits(plan: string, isVip: boolean, isAdmin: boolean = false) {
  if (isAdmin || isVip) return PLAN_LIMITS.VIP; // admins + VIP = unlimited
  return PLAN_LIMITS[plan as keyof typeof PLAN_LIMITS] ?? PLAN_LIMITS.FREE;
}
