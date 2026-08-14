import { MockedProvider, type MockedResponse } from '@apollo/client/testing';
import { GraphQLError } from 'graphql';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { GetPostDocument } from '../../../generated/graphql';
import SinglePost from './SinglePost';

const renderPostRoute = (
  initialEntry: string,
  mocks: readonly MockedResponse[] = [],
  routePath = '/posts/:postId'
) =>
  render(
    <MockedProvider mocks={mocks}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path={routePath} element={<SinglePost />} />
        </Routes>
      </MemoryRouter>
    </MockedProvider>
  );

describe('SinglePost', () => {
  it('shows a loading state while the post request is pending', () => {
    renderPostRoute('/posts/post-id', [
      {
        request: { query: GetPostDocument, variables: { id: 'post-id' } },
        delay: 100_000,
        result: { data: { post: null } }
      }
    ]);

    expect(screen.getByRole('status')).toHaveTextContent('Loading post...');
  });

  it('shows the request error instead of an empty post shell', async () => {
    renderPostRoute('/posts/missing-post', [
      {
        request: { query: GetPostDocument, variables: { id: 'missing-post' } },
        result: { errors: [new GraphQLError('Post not found.')] }
      }
    ]);

    expect(await screen.findByRole('alert')).toHaveTextContent('Post not found.');
  });

  it('shows an explicit empty state without a route post id', async () => {
    renderPostRoute('/', [], '/');

    expect(await screen.findByRole('heading', { name: 'Post not found.' })).toBeVisible();
  });
});
