export type Session = {
  token: string;
  userId: string;
  expiresAt: number;
};

const listeners = new Set<() => void>();
let logoutTimer: ReturnType<typeof setTimeout> | null = null;

const clearStoredSession = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('expiryDate');
  localStorage.removeItem('userId');
};

const readStoredSession = (): Session | null => {
  const token = localStorage.getItem('token');
  const userId = localStorage.getItem('userId');
  const expiryDate = localStorage.getItem('expiryDate');
  const expiresAt = expiryDate ? Date.parse(expiryDate) : Number.NaN;

  if (!token || !userId || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    clearStoredSession();
    return null;
  }

  return { token, userId, expiresAt };
};

let session = readStoredSession();

const notify = () => listeners.forEach((listener) => listener());

const scheduleExpiry = () => {
  if (logoutTimer) {
    clearTimeout(logoutTimer);
    logoutTimer = null;
  }
  if (!session) {
    return;
  }

  logoutTimer = setTimeout(clearSession, Math.max(session.expiresAt - Date.now(), 0));
};

export const getSession = () => session;

export const subscribeToSession = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const saveSession = (token: string, userId: string, expiresInSeconds: number) => {
  const expiresAt = Date.now() + expiresInSeconds * 1000;
  session = { token, userId, expiresAt };
  localStorage.setItem('token', token);
  localStorage.setItem('userId', userId);
  localStorage.setItem('expiryDate', new Date(expiresAt).toISOString());
  scheduleExpiry();
  notify();
};

export const clearSession = () => {
  if (logoutTimer) {
    clearTimeout(logoutTimer);
    logoutTimer = null;
  }
  if (!session && !localStorage.getItem('token')) {
    return;
  }

  session = null;
  clearStoredSession();
  notify();
};

scheduleExpiry();
