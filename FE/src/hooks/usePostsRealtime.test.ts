import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { PostsRealtimeEvent } from '../pages/Feed/types';
import { usePostsRealtime } from './usePostsRealtime';

const socketMock = vi.hoisted(() => ({
  handlers: new Map<string, (value: unknown) => void>(),
  disconnect: vi.fn(),
  connect: vi.fn()
}));

vi.mock('socket.io-client', () => ({
  default: (...args: unknown[]) => {
    socketMock.connect(...args);
    return {
      on: (event: string, handler: (value: unknown) => void) => {
        socketMock.handlers.set(event, handler);
      },
      disconnect: socketMock.disconnect
    };
  }
}));

describe('usePostsRealtime', () => {
  beforeEach(() => {
    socketMock.handlers.clear();
    socketMock.disconnect.mockClear();
    socketMock.connect.mockClear();
  });

  it('delivers duplicate socket events only once', () => {
    const onEvent = vi.fn();
    const event: PostsRealtimeEvent = {
      action: 'create',
      post: {
        _id: 'post-id',
        title: 'Post',
        content: 'Content',
        imageUrl: '/images/post.png',
        createdAt: '2026-08-09T12:00:00.000Z',
        updatedAt: '2026-08-09T12:00:00.000Z',
        creator: { _id: 'user-id', name: 'User' }
      }
    };

    const { unmount } = renderHook(() =>
      usePostsRealtime({
        token: 'jwt-token',
        onEvent,
        onError: vi.fn(),
        onUnauthorized: vi.fn()
      })
    );

    act(() => {
      socketMock.handlers.get('posts')?.(event);
      socketMock.handlers.get('posts')?.(event);
    });

    expect(onEvent).toHaveBeenCalledOnce();
    expect(socketMock.connect).toHaveBeenCalledWith(expect.any(String), {
      auth: { token: 'jwt-token' }
    });

    unmount();
    expect(socketMock.disconnect).toHaveBeenCalledOnce();
  });
});
