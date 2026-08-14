import { InMemoryCache, useQuery } from '@apollo/client';
import { MockedProvider, type MockedResponse } from '@apollo/client/testing';
import { act, renderHook, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import { DeletePostDocument, GetPostDocument, GetPostsDocument } from '../generated/graphql';
import { usePostMutations } from './usePostMutations';

const post = {
  __typename: 'Post' as const,
  _id: 'post-id',
  content: 'Cached post',
  imageUrl: null,
  createdAt: '2026-08-09T12:00:00.000Z',
  updatedAt: '2026-08-09T12:00:00.000Z',
  creator: { __typename: 'User' as const, _id: 'user-id', name: 'User' }
};

const feed = (posts: (typeof post)[]) => ({
  __typename: 'PostsData' as const,
  totalItems: posts.length,
  posts,
  pageInfo: { __typename: 'PageInfo' as const, endCursor: null, hasNextPage: false }
});

describe('usePostMutations', () => {
  it('evicts a deleted post from single-post cache while refetching the active feed', async () => {
    const cache = new InMemoryCache({
      typePolicies: {
        RootQuery: { queryType: true },
        RootMutation: { mutationType: true },
        Post: { keyFields: ['_id'] },
        User: { keyFields: ['_id'] }
      }
    });
    cache.writeQuery({
      query: GetPostDocument,
      variables: { id: 'post-id' },
      data: { post }
    });
    const feedVariables = { first: 10, after: null, creatorId: null };
    const mocks: MockedResponse[] = [
      {
        request: { query: GetPostsDocument, variables: feedVariables },
        result: { data: { posts: feed([post]) } }
      },
      {
        request: { query: DeletePostDocument, variables: { id: 'post-id' } },
        result: { data: { deletePost: true } }
      },
      {
        request: { query: GetPostsDocument, variables: feedVariables },
        result: { data: { posts: feed([]) } }
      }
    ];
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(MockedProvider, { cache, mocks }, children);
    const { result } = renderHook(
      () => {
        const activeFeed = useQuery(GetPostsDocument, { variables: feedVariables });
        return { activeFeed, mutations: usePostMutations() };
      },
      { wrapper }
    );

    await waitFor(() => expect(result.current.activeFeed.data?.posts.posts).toHaveLength(1));
    await act(async () => {
      await result.current.mutations.removePost('post-id');
    });

    expect(cache.readQuery({ query: GetPostDocument, variables: { id: 'post-id' } })).toBeNull();
    expect(result.current.activeFeed.data?.posts.posts).toEqual([]);
  });
});
