import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import FeedEdit from './FeedEdit';

describe('FeedEdit', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="backdrop-root"></div><div id="modal-root"></div>';
  });

  it('preserves the draft when saving fails', async () => {
    const onFinishEdit = vi.fn().mockRejectedValue(new Error('Save failed.'));
    render(
      <FeedEdit
        editing
        selectedPost={null}
        loading={false}
        onCancelEdit={vi.fn()}
        onFinishEdit={onFinishEdit}
      />
    );

    const content = screen.getByLabelText('Content');
    fireEvent.change(content, { target: { value: 'Keep this draft.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Accept' }));

    await waitFor(() => expect(onFinishEdit).toHaveBeenCalledOnce());
    expect(content).toHaveValue('Keep this draft.');
    expect(screen.getByRole('dialog', { name: 'New post' })).toBeVisible();
  });
});
