import { InMemoryCache, useQuery } from '@apollo/client';
import { MockedProvider, type MockedResponse } from '@apollo/client/testing';
import { act, renderHook, waitFor } from '@testing-library/react';
import { GraphQLError } from 'graphql';
import { createElement, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CreatePostDocument, DeletePostDocument, GetPostsDocument } from '../generated/graphql';
import { uploadImage } from '../util/upload';
import { usePostMutations } from './usePostMutations';

vi.mock('../util/upload', () => ({ uploadImage: vi.fn() }));

const post = {
  __typename: 'Post' as const,
  _id: 'post-id',
  content: 'Saved post',
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

const feedVariables = { first: 10, after: null, creatorId: null };
const feedRequest = { query: GetPostsDocument, variables: feedVariables };
const initialFeed: MockedResponse = {
  request: feedRequest,
  result: { data: { posts: feed([]) } }
};
const createRequest = {
  query: CreatePostDocument,
  variables: {
    postInput: { content: 'Saved post', imageUploadId: 'upload-id', removeImage: false }
  }
};
const editorData = {
  content: 'Saved post',
  image: new File(['image'], 'photo.png', { type: 'image/png' }),
  removeImage: false
};

const renderMutations = (mocks: MockedResponse[]) => {
  const cache = new InMemoryCache({
    typePolicies: { Post: { keyFields: ['_id'] }, User: { keyFields: ['_id'] } }
  });
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(MockedProvider, { cache, mocks }, children);

  return renderHook(
    () => {
      const activeFeed = useQuery(GetPostsDocument, { variables: feedVariables });
      return { activeFeed, mutations: usePostMutations() };
    },
    { wrapper }
  );
};

describe('usePostMutations lifecycle', () => {
  beforeEach(() => {
    vi.mocked(uploadImage).mockReset();
  });

  it('ignores a second submission while the first is still uploading', async () => {
    let finishUpload: (uploadId: string) => void = () => {};
    vi.mocked(uploadImage).mockReturnValue(
      new Promise((resolve) => {
        finishUpload = resolve;
      })
    );
    // Only one create response is queued, so a duplicate mutation would fail.
    const { result } = renderMutations([
      initialFeed,
      { request: createRequest, result: { data: { createPost: post } } },
      { request: feedRequest, result: { data: { posts: feed([post]) } } }
    ]);
    await waitFor(() => expect(result.current.activeFeed.data).toBeDefined());

    let first!: Promise<unknown>;
    let second!: Promise<unknown>;
    act(() => {
      first = result.current.mutations.savePost(editorData);
      second = result.current.mutations.savePost(editorData);
    });

    expect(result.current.mutations.saving).toBe(true);
    await expect(second).resolves.toEqual({ status: 'ignored' });

    await act(async () => {
      finishUpload('upload-id');
      await first;
    });

    await expect(first).resolves.toEqual({ status: 'completed', refreshFailed: false });
    expect(uploadImage).toHaveBeenCalledTimes(1);
    expect(result.current.mutations.saving).toBe(false);
    expect(result.current.activeFeed.data?.posts.posts).toHaveLength(1);
  });

  it('allows another submission after a failed upload', async () => {
    vi.mocked(uploadImage).mockRejectedValueOnce(new Error('Image upload failed.'));
    const { result } = renderMutations([initialFeed]);
    await waitFor(() => expect(result.current.activeFeed.data).toBeDefined());

    await act(async () => {
      await expect(result.current.mutations.savePost(editorData)).rejects.toThrow(
        'Image upload failed.'
      );
    });

    expect(result.current.mutations.saving).toBe(false);
    vi.mocked(uploadImage).mockRejectedValueOnce(new Error('Image upload failed again.'));
    await act(async () => {
      await expect(result.current.mutations.savePost(editorData)).rejects.toThrow(
        'Image upload failed again.'
      );
    });
  });

  it('reports a committed create as saved when only the feed refetch fails, and retries without re-creating', async () => {
    vi.mocked(uploadImage).mockResolvedValue('upload-id');
    const created = vi.fn(() => ({ data: { createPost: post } }));
    const { result } = renderMutations([
      initialFeed,
      { request: createRequest, result: created },
      { request: feedRequest, error: new Error('Network down') },
      { request: feedRequest, result: { data: { posts: feed([post]) } } }
    ]);
    await waitFor(() => expect(result.current.activeFeed.data).toBeDefined());

    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.mutations.savePost(editorData);
    });

    expect(outcome).toEqual({ status: 'completed', refreshFailed: true });
    expect(result.current.mutations.feedRefreshFailed).toBe(true);

    await act(async () => {
      await result.current.mutations.refreshFeed();
    });

    expect(result.current.mutations.feedRefreshFailed).toBe(false);
    expect(result.current.activeFeed.data?.posts.posts).toHaveLength(1);
    expect(created).toHaveBeenCalledTimes(1);
  });

  it('reports a committed delete as completed when only the feed refetch fails', async () => {
    const deleted = vi.fn(() => ({ data: { deletePost: true } }));
    const { result } = renderMutations([
      { request: feedRequest, result: { data: { posts: feed([post]) } } },
      { request: { query: DeletePostDocument, variables: { id: 'post-id' } }, result: deleted },
      { request: feedRequest, error: new Error('Network down') },
      { request: feedRequest, result: { data: { posts: feed([]) } } }
    ]);
    await waitFor(() => expect(result.current.activeFeed.data?.posts.posts).toHaveLength(1));

    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.mutations.removePost('post-id');
    });

    expect(outcome).toEqual({ status: 'completed', refreshFailed: true });
    await act(async () => {
      await result.current.mutations.refreshFeed();
    });
    expect(result.current.mutations.feedRefreshFailed).toBe(false);
    expect(deleted).toHaveBeenCalledTimes(1);
  });

  it('still rejects when the create mutation itself fails', async () => {
    vi.mocked(uploadImage).mockResolvedValue('upload-id');
    const { result } = renderMutations([
      initialFeed,
      { request: createRequest, result: { errors: [new GraphQLError('Could not save.')] } }
    ]);
    await waitFor(() => expect(result.current.activeFeed.data).toBeDefined());

    await act(async () => {
      await expect(result.current.mutations.savePost(editorData)).rejects.toThrow(
        'Could not save.'
      );
    });
    expect(result.current.mutations.feedRefreshFailed).toBe(false);
    expect(result.current.mutations.saving).toBe(false);
  });
});
