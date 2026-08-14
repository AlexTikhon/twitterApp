import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import Modal from './Modal';

describe('Modal accessibility', () => {
  beforeEach(() => {
    document.body.innerHTML = '<button id="outside">Open</button><div id="modal-root"></div>';
  });

  it('moves, traps, and restores focus and supports Escape', async () => {
    const outside = document.getElementById('outside') as HTMLButtonElement;
    outside.focus();
    const onCancel = vi.fn();
    const { unmount } = render(
      <Modal title="Edit post" acceptEnabled onAcceptModal={vi.fn()} onCancelModal={onCancel}>
        <label htmlFor="content">Content</label>
        <textarea id="content" />
      </Modal>
    );

    const dialog = screen.getByRole('dialog', { name: 'Edit post' });
    const content = screen.getByLabelText('Content');
    await waitFor(() => expect(content).toHaveFocus());

    const accept = screen.getByRole('button', { name: 'Accept' });
    accept.focus();
    fireEvent.keyDown(accept, { key: 'Tab' });
    expect(content).toHaveFocus();

    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledOnce();

    unmount();
    expect(outside).toHaveFocus();
  });
});
