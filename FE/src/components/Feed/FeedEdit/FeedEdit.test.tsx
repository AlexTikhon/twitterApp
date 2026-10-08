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

  it('submits once when Accept is clicked repeatedly before the first save settles', async () => {
    let finishSave: () => void = () => {};
    const onFinishEdit = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finishSave = resolve;
        })
    );
    render(
      <FeedEdit
        editing
        selectedPost={null}
        loading={false}
        onCancelEdit={vi.fn()}
        onFinishEdit={onFinishEdit}
      />
    );

    fireEvent.change(screen.getByLabelText('Content'), { target: { value: 'Post once.' } });
    const accept = screen.getByRole('button', { name: 'Accept' });
    fireEvent.click(accept);
    fireEvent.click(accept);
    fireEvent.click(accept);

    expect(onFinishEdit).toHaveBeenCalledOnce();

    finishSave();
    await waitFor(() => expect(screen.getByLabelText('Content')).toHaveValue(''));
  });

  it('keeps the draft and the editor open when the parent ignores the submission', async () => {
    const onFinishEdit = vi.fn().mockResolvedValue(false);
    render(
      <FeedEdit
        editing
        selectedPost={null}
        loading={false}
        onCancelEdit={vi.fn()}
        onFinishEdit={onFinishEdit}
      />
    );

    fireEvent.change(screen.getByLabelText('Content'), { target: { value: 'Keep this.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Accept' }));

    await waitFor(() => expect(onFinishEdit).toHaveBeenCalledOnce());
    expect(screen.getByLabelText('Content')).toHaveValue('Keep this.');
  });
});
