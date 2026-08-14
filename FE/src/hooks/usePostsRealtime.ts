import { useApolloClient } from '@apollo/client';
import { useEffect, useRef } from 'react';
import openSocket from 'socket.io-client';

import { API_URL } from '../config';
import { GetPostsDocument, PostFieldsFragmentDoc } from '../generated/graphql';
import type { PostsRealtimeEvent } from '../pages/Feed/types';

type UsePostsRealtimeOptions = {
  token: string | null;
  onError: (error: Error) => void;
  onUnauthorized: () => void;
};

const getEventKey = (event: PostsRealtimeEvent) => {
  if (event.action === 'delete') {
    return `delete:${event.post._id}`;
  }

  return `${event.action}:${event.post._id}:${event.post.updatedAt}`;
};

export const usePostsRealtime = ({ token, onError, onUnauthorized }: UsePostsRealtimeOptions) => {
  const client = useApolloClient();
  const seenEvents = useRef(new Set<string>());
  const callbacks = useRef({ onError, onUnauthorized });

  useEffect(() => {
    callbacks.current = { onError, onUnauthorized };
  }, [onError, onUnauthorized]);

  useEffect(() => {
    seenEvents.current.clear();
    if (!token) {
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
    socket.on('posts', async (event: PostsRealtimeEvent) => {
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

      try {
        if (event.action === 'create') {
          await client.refetchQueries({ include: [GetPostsDocument] });
          return;
        }

        const cacheId = client.cache.identify({ __typename: 'Post', _id: event.post._id });
        if (!cacheId) {
          return;
        }

        if (event.action === 'delete') {
          client.cache.evict({ id: cacheId });
          client.cache.gc();
          return;
        }

        client.cache.writeFragment({
          id: cacheId,
          fragment: PostFieldsFragmentDoc,
          data: event.post
        });
      } catch (error) {
        callbacks.current.onError(
          error instanceof Error ? error : new Error('Realtime reconciliation failed.')
        );
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [client, token]);
};
