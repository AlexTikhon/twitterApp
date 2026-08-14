import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import Post from './Post';

const renderPost = (canModify: boolean, deleting = false) =>
  render(
    <MemoryRouter>
      <Post
        id="post-id"
        authorId="user-id"
        author="Ada"
        date="August 9"
        content="Architecture should stay understandable."
        canModify={canModify}
        deleting={deleting}
        onStartEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    </MemoryRouter>
  );

describe('Post permissions', () => {
  it('does not render mutation actions for another user post', () => {
    renderPost(false);

    expect(screen.getByRole('link', { name: 'View' })).toHaveAttribute('href', '/posts/post-id');
    expect(screen.getByRole('link', { name: 'Ada' })).toHaveAttribute('href', '/users/user-id');
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
  });

  it('renders mutation actions for the post owner', () => {
    renderPost(true);

    expect(screen.getByRole('button', { name: 'Edit' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeEnabled();
  });

  it('disables mutation actions while this post is being deleted', () => {
    renderPost(true, true);

    expect(screen.getByRole('button', { name: 'Edit' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Loading...' })).toBeDisabled();
  });
});
