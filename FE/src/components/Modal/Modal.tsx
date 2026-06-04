// Shared modal window rendered through a portal so it can escape page layout constraints.
import React from 'react';
import ReactDOM from 'react-dom';

import Button from '../Button/Button';
import './Modal.css';

type ModalProps = {
  title: string;
  children: React.ReactNode;
  acceptEnabled?: boolean;
  isLoading?: boolean;
  onCancelModal: () => void;
  onAcceptModal: () => void;
};

// Renders modal content and actions into the dedicated modal portal root.
const modal = (props: ModalProps) => {
  const modalRoot = document.getElementById('modal-root');

  if (!modalRoot) {
    return null;
  }

  return ReactDOM.createPortal(
    <div className="modal">
      <header className="modal__header">
        <h1>{props.title}</h1>
      </header>
      <div className="modal__content">{props.children}</div>
      <div className="modal__actions">
        <Button design="danger" mode="flat" onClick={props.onCancelModal}>
          Cancel
        </Button>
        <Button
          mode="raised"
          onClick={props.onAcceptModal}
          disabled={!props.acceptEnabled}
          loading={props.isLoading}
        >
          Accept
        </Button>
      </div>
    </div>,
    modalRoot
  );
};

export default modal;
