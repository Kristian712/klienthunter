import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-change-in-production';

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
