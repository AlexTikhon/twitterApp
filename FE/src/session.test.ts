import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { clearSession, getSession, saveSession, subscribeToSession } from './session';

describe('session', () => {
  beforeEach(() => {
    clearSession();
    localStorage.clear();
  });

  afterEach(() => {
    clearSession();
    vi.useRealTimers();
  });

  it('persists a login and notifies subscribers', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToSession(listener);

    saveSession('token-value', 'user-id', 60);

    expect(getSession()).toMatchObject({ token: 'token-value', userId: 'user-id' });
    expect(localStorage.getItem('token')).toBe('token-value');
    expect(localStorage.getItem('userId')).toBe('user-id');
    expect(listener).toHaveBeenCalledOnce();

    unsubscribe();
  });

  it('clears the session when its lifetime expires', () => {
    vi.useFakeTimers();
    saveSession('short-lived-token', 'user-id', 1);

    vi.advanceTimersByTime(1000);

    expect(getSession()).toBeNull();
    expect(localStorage.getItem('token')).toBeNull();
  });
});
