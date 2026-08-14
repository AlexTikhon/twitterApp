import { InMemoryCache, useQuery } from '@apollo/client';
import { MockedProvider, type MockedResponse } from '@apollo/client/testing';
import { act, renderHook, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GetPostsDocument, PostFieldsFragmentDoc } from '../generated/graphql';
import type { PostsRealtimeEvent } from '../pages/Feed/types';
import { usePostsRealtime } from './usePostsRealtime';

const socketMock = vi.hoisted(() => ({
  handlers: new Map<string, (value: unknown) => unknown>(),
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

const post = (id: string, content: string) => ({
  __typename: 'Post' as const,
  _id: id,
  content,
  imageUrl: null,
  createdAt: '2026-08-09T12:00:00.000Z',
  updatedAt: '2026-08-09T12:00:00.000Z',
  creator: { __typename: 'User' as const, _id: 'user-id', name: 'User' }
});

const page = (posts: ReturnType<typeof post>[]) => ({
  __typename: 'PostsData' as const,
  totalItems: posts.length,
  posts,
  pageInfo: { __typename: 'PageInfo' as const, endCursor: null, hasNextPage: false }
});

const createCache = () =>
  new InMemoryCache({
    typePolicies: {
      RootQuery: { queryType: true },
      Post: { keyFields: ['_id'] },
      User: { keyFields: ['_id'] }
    }
  });

describe('usePostsRealtime', () => {
  beforeEach(() => {
    socketMock.handlers.clear();
    socketMock.disconnect.mockClear();
    socketMock.connect.mockClear();
  });

  it('deduplicates events and reconciles normalized updates and deletes', async () => {
    const cache = createCache();
    cache.writeFragment({
      id: cache.identify({ __typename: 'Post', _id: 'post-id' }),
      fragment: PostFieldsFragmentDoc,
      data: post('post-id', 'Original')
    });
    const writeFragment = vi.spyOn(cache, 'writeFragment');
    const onError = vi.fn();
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(MockedProvider, { cache }, children);

    const { unmount } = renderHook(
      () =>
        usePostsRealtime({
          token: 'jwt-token',
          onError,
          onUnauthorized: vi.fn()
        }),
      { wrapper }
    );

    const update: PostsRealtimeEvent = {
      action: 'update',
      post: post('post-id', 'Updated')
    };
    await act(async () => {
      await Promise.all([
        socketMock.handlers.get('posts')?.(update),
        socketMock.handlers.get('posts')?.(update)
      ]);
    });

    expect(writeFragment).toHaveBeenCalledOnce();
    expect(
      cache.readFragment({
        id: cache.identify({ __typename: 'Post', _id: 'post-id' }),
        fragment: PostFieldsFragmentDoc
      })
    ).toMatchObject({ content: 'Updated' });

    await act(async () => {
      await socketMock.handlers.get('posts')?.({ action: 'delete', post: { _id: 'post-id' } });
    });
    expect(
      cache.readFragment({
        id: cache.identify({ __typename: 'Post', _id: 'post-id' }),
        fragment: PostFieldsFragmentDoc
      })
    ).toBeNull();
    expect(onError).not.toHaveBeenCalled();
    expect(socketMock.connect).toHaveBeenCalledWith(expect.any(String), {
      auth: { token: 'jwt-token' }
    });

    unmount();
    expect(socketMock.disconnect).toHaveBeenCalledOnce();
  });

  it('refetches an active creator-filtered feed after a create event', async () => {
    const variables = { first: 10, after: null, creatorId: 'profile-user' };
    const mocks: MockedResponse[] = [
      {
        request: { query: GetPostsDocument, variables },
        result: { data: { posts: page([post('post-1', 'Original profile post')]) } }
      },
      {
        request: { query: GetPostsDocument, variables },
        result: {
          data: {
            posts: page([
              post('post-2', 'Realtime profile post'),
              post('post-1', 'Original profile post')
            ])
          }
        }
      }
    ];
    const cache = createCache();
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(MockedProvider, { mocks, cache }, children);
    const { result } = renderHook(
      () => {
        const query = useQuery(GetPostsDocument, { variables });
        usePostsRealtime({
          token: 'jwt-token',
          onError: vi.fn(),
          onUnauthorized: vi.fn()
        });
        return query;
      },
      { wrapper }
    );

    await waitFor(() => expect(result.current.data?.posts.posts).toHaveLength(1));
    await act(async () => {
      await socketMock.handlers.get('posts')?.({
        action: 'create',
        post: post('post-2', 'Realtime profile post')
      });
    });

    await waitFor(() =>
      expect(result.current.data?.posts.posts.map(({ _id }) => _id)).toEqual(['post-2', 'post-1'])
    );
  });
});
