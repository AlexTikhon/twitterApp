import { MockedProvider, type MockedResponse } from '@apollo/client/testing';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  CreatePostDocument,
  DeletePostDocument,
  GetPostsDocument,
  GetStatusDocument
} from '../../generated/graphql';
import Feed from './Feed';

const post = {
  __typename: 'Post' as const,
  _id: 'post-id',
  content: 'Existing post',
  imageUrl: null,
  createdAt: '2026-08-09T12:00:00.000Z',
  updatedAt: '2026-08-09T12:00:00.000Z',
  creator: { __typename: 'User' as const, _id: 'user-id', name: 'User' }
};
const created = { ...post, _id: 'new-post-id', content: 'Brand new post' };
const feed = (posts: (typeof post)[]) => ({
  __typename: 'PostsData' as const,
  totalItems: posts.length,
  posts,
  pageInfo: { __typename: 'PageInfo' as const, endCursor: null, hasNextPage: false }
});

const feedRequest = {
  query: GetPostsDocument,
  variables: { first: 10, after: null, creatorId: null }
};
const statusMock: MockedResponse = {
  request: { query: GetStatusDocument },
  result: { data: { status: { __typename: 'StatusData', status: 'Hello' } } }
};

const renderFeed = (mocks: MockedResponse[]) =>
  render(
    <MockedProvider mocks={[statusMock, ...mocks]}>
      <MemoryRouter>
        <Feed userId="user-id" />
      </MemoryRouter>
    </MockedProvider>
  );

describe('Feed', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="backdrop-root"></div><div id="modal-root"></div>';
  });

  it('treats a created post as saved when the refetch fails, and retries only the refresh', async () => {
    const createMutation = vi.fn(() => ({ data: { createPost: created } }));
    renderFeed([
      { request: feedRequest, result: { data: { posts: feed([post]) } } },
      {
        request: {
          query: CreatePostDocument,
          variables: {
            postInput: { content: 'Brand new post', imageUploadId: null, removeImage: false }
          }
        },
        result: createMutation
      },
      { request: feedRequest, error: new Error('Network down') },
      { request: feedRequest, result: { data: { posts: feed([created, post]) } } }
    ]);
    await screen.findByText('Existing post');

    fireEvent.click(screen.getByRole('button', { name: 'New Post' }));
    fireEvent.change(await screen.findByLabelText('Content'), {
      target: { value: 'Brand new post' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Accept' }));

    const notice = await screen.findByRole('status', { name: 'Feed refresh' });
    expect(notice).toHaveTextContent('Your change was saved, but the feed could not be refreshed.');
    expect(screen.queryByRole('dialog', { name: 'New post' })).not.toBeInTheDocument();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();

    fireEvent.click(within(notice).getByRole('button', { name: 'Refresh feed' }));

    expect(await screen.findByText('Brand new post')).toBeVisible();
    await waitFor(() => expect(screen.queryByRole('status', { name: 'Feed refresh' })).toBeNull());
    expect(createMutation).toHaveBeenCalledTimes(1);
  });

  it('treats a deleted post as deleted when the refetch fails', async () => {
    const deleteMutation = vi.fn(() => ({ data: { deletePost: true } }));
    renderFeed([
      { request: feedRequest, result: { data: { posts: feed([post]) } } },
      {
        request: { query: DeletePostDocument, variables: { id: 'post-id' } },
        result: deleteMutation
      },
      { request: feedRequest, error: new Error('Network down') }
    ]);
    await screen.findByText('Existing post');

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(await screen.findByRole('status', { name: 'Feed refresh' })).toHaveTextContent(
      'Your change was saved, but the feed could not be refreshed.'
    );
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(deleteMutation).toHaveBeenCalledTimes(1);
  });
});
