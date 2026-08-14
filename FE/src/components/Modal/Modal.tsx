import ReactDOM from 'react-dom';
import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from 'react';

import Button from '../Button/Button';
import './Modal.css';

type ModalProps = {
  title: string;
  children: ReactNode;
  acceptEnabled?: boolean;
  isLoading?: boolean;
  role?: 'dialog' | 'alertdialog';
  onCancelModal: () => void;
  onAcceptModal: () => void;
};

const Modal = (props: ModalProps) => {
  const modalRoot = document.getElementById('modal-root');
  const modalRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const firstControl = modalRef.current?.querySelector<HTMLElement>(
      'input:not([disabled]), textarea:not([disabled]), button:not([disabled]), a[href]'
    );
    (firstControl || modalRef.current)?.focus();
    return () => previouslyFocused?.focus();
  }, []);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      props.onCancelModal();
      return;
    }
    if (event.key !== 'Tab') {
      return;
    }

    const focusable = [
      ...(modalRef.current?.querySelectorAll<HTMLElement>(
        'input:not([disabled]), textarea:not([disabled]), button:not([disabled]), a[href]'
      ) || [])
    ];
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  };

  if (!modalRoot) {
    return null;
  }

  return ReactDOM.createPortal(
    <div
      ref={modalRef}
      className="modal"
      role={props.role || 'dialog'}
      aria-modal="true"
      aria-labelledby={titleId}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
    >
      <header className="modal__header">
        <h1 id={titleId}>{props.title}</h1>
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

export default Modal;
