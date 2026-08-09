import { useEffect, useRef } from 'react';
import openSocket from 'socket.io-client';

import { API_URL } from '../config';
import type { PostsRealtimeEvent } from '../pages/Feed/types';

type UsePostsRealtimeOptions = {
  token: string | null;
  onEvent: (event: PostsRealtimeEvent) => void;
  onError: (error: Error) => void;
  onUnauthorized: () => void;
};

const getEventKey = (event: PostsRealtimeEvent) => {
  if (event.action === 'delete') {
    return `delete:${event.post._id}`;
  }

  return `${event.action}:${event.post._id}:${event.post.updatedAt}`;
};

export const usePostsRealtime = ({
  token,
  onEvent,
  onError,
  onUnauthorized
}: UsePostsRealtimeOptions) => {
  const seenEvents = useRef(new Set<string>());
  const callbacks = useRef({ onEvent, onError, onUnauthorized });

  useEffect(() => {
    callbacks.current = { onEvent, onError, onUnauthorized };
  }, [onError, onEvent, onUnauthorized]);

  useEffect(() => {
    if (!token) {
      callbacks.current.onUnauthorized();
      return;
    }

    const socket = openSocket(API_URL, { auth: { token } });

    socket.on('connect_error', (error: Error) => {
      if (error.message === 'Not authenticated.') {
        callbacks.current.onUnauthorized();
        return;
      }

      callbacks.current.onError(error);
    });
    socket.on('posts', (event: PostsRealtimeEvent) => {
      const eventKey = getEventKey(event);
      if (seenEvents.current.has(eventKey)) {
        return;
      }

      seenEvents.current.add(eventKey);
      if (seenEvents.current.size > 200) {
        const oldestKey = seenEvents.current.values().next().value;
        if (oldestKey) {
          seenEvents.current.delete(oldestKey);
        }
      }
      callbacks.current.onEvent(event);
    });

    return () => {
      socket.disconnect();
    };
  }, [token]);
};
