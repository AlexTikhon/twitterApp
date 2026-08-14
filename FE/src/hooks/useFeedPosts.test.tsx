import { MockedProvider, type MockedResponse } from '@apollo/client/testing';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import { GetPostsDocument } from '../generated/graphql';
import { useFeedPosts } from './useFeedPosts';

const post = (id: string, content: string) => ({
  __typename: 'Post' as const,
  _id: id,
  content,
  imageUrl: null,
  createdAt: '2026-08-09T12:00:00.000Z',
  updatedAt: '2026-08-09T12:00:00.000Z',
  creator: { __typename: 'User' as const, _id: 'user-id', name: 'User' }
});

const page = (
  posts: ReturnType<typeof post>[],
  endCursor: string | null,
  hasNextPage: boolean
) => ({
  __typename: 'PostsData' as const,
  totalItems: 3,
  posts,
  pageInfo: { __typename: 'PageInfo' as const, endCursor, hasNextPage }
});

const mocks: MockedResponse[] = [
  {
    request: {
      query: GetPostsDocument,
      variables: { first: 10, after: null, creatorId: null }
    },
    result: {
      data: { posts: page([post('post-3', 'Third'), post('post-2', 'Second')], 'c2', true) }
    }
  },
  {
    request: {
      query: GetPostsDocument,
      variables: { first: 10, after: 'c2', creatorId: null }
    },
    result: { data: { posts: page([post('post-1', 'First')], 'c1', false) } }
  }
];

const wrapper = ({ children }: { children: ReactNode }) => (
  <MockedProvider mocks={mocks}>{children}</MockedProvider>
);

describe('useFeedPosts', () => {
  it('merges cursor pages once and applies realtime cache changes', async () => {
    const { result } = renderHook(() => useFeedPosts(), { wrapper });

    await waitFor(() => expect(result.current.posts).toHaveLength(2));
    await act(async () => {
      await Promise.all([result.current.loadMore(), result.current.loadMore()]);
    });
    await waitFor(() =>
      expect(result.current.posts.map(({ _id }) => _id)).toEqual(['post-3', 'post-2', 'post-1'])
    );

    act(() => {
      result.current.applyRealtimeEvent({ action: 'update', post: post('post-2', 'Updated') });
    });
    await waitFor(() => expect(result.current.posts[1].content).toBe('Updated'));

    act(() => {
      result.current.applyRealtimeEvent({ action: 'delete', post: { _id: 'post-2' } });
    });
    await waitFor(() =>
      expect(result.current.posts.map(({ _id }) => _id)).toEqual(['post-3', 'post-1'])
    );
  });
});
