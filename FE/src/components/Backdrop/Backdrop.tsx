// Shared overlay rendered through a portal behind modals and mobile navigation.
import React from 'react';
import ReactDOM from 'react-dom';

import './Backdrop.css';

type BackdropProps = {
  open?: boolean;
  onClick?: React.MouseEventHandler<HTMLDivElement>;
};

// Renders a clickable overlay into the dedicated backdrop portal root.
const backdrop = (props: BackdropProps) => {
  const backdropRoot = document.getElementById('backdrop-root');

  if (!backdropRoot) {
    return null;
  }

  return ReactDOM.createPortal(
    <div className={['backdrop', props.open ? 'open' : ''].join(' ')} onClick={props.onClick} />,
    backdropRoot
  );
};

export default backdrop;
