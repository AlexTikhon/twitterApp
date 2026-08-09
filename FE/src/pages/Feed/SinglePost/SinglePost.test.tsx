import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import SinglePost from './SinglePost';

const graphqlMock = vi.hoisted(() => ({
  request: vi.fn(),
  isUnauthorized: vi.fn(() => false)
}));

vi.mock('../../../util/graphql', () => ({
  graphqlRequest: graphqlMock.request,
  isUnauthorizedError: graphqlMock.isUnauthorized
}));

const renderPostRoute = (initialEntry: string, routePath = '/:postId') =>
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path={routePath} element={<SinglePost onLogout={vi.fn()} />} />
      </Routes>
    </MemoryRouter>
  );

describe('SinglePost', () => {
  beforeEach(() => {
    graphqlMock.request.mockReset();
    graphqlMock.isUnauthorized.mockReset();
    graphqlMock.isUnauthorized.mockReturnValue(false);
  });

  it('shows a loading state while the post request is pending', () => {
    graphqlMock.request.mockReturnValue(new Promise(() => {}));

    renderPostRoute('/post-id');

    expect(screen.getByRole('status')).toHaveTextContent('Loading post...');
  });

  it('shows the request error instead of an empty post shell', async () => {
    graphqlMock.request.mockRejectedValue(new Error('Post not found.'));

    renderPostRoute('/missing-post');

    expect(await screen.findByRole('alert')).toHaveTextContent('Post not found.');
  });

  it('shows an explicit empty state without a route post id', async () => {
    renderPostRoute('/', '/');

    expect(await screen.findByRole('heading', { name: 'Post not found.' })).toBeVisible();
    expect(graphqlMock.request).not.toHaveBeenCalled();
  });
});
