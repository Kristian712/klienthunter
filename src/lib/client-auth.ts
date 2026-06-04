// Client-side auth helpers (browser only)

export interface StoredUser {
  id: string;
  email: string;
  name?: string;
  plan: string;
  isAdmin: boolean;
  isVip: boolean;
}

const KEY = 'kh_user';

export function saveUser(user: StoredUser) {
  try { localStorage.setItem(KEY, JSON.stringify(user)); } catch {}
}

export function loadUser(): StoredUser | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredUser;
  } catch { return null; }
}

export function clearUser() {
  try { localStorage.removeItem(KEY); } catch {}
}
