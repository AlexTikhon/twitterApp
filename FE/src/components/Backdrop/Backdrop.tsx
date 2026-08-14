import ReactDOM from 'react-dom';
import type { MouseEventHandler } from 'react';

import './Backdrop.css';

type BackdropProps = {
  onClick?: MouseEventHandler<HTMLDivElement>;
};

const backdrop = (props: BackdropProps) => {
  const backdropRoot = document.getElementById('backdrop-root');

  if (!backdropRoot) {
    return null;
  }

  return ReactDOM.createPortal(
    <div className="backdrop" onClick={props.onClick} aria-hidden="true" />,
    backdropRoot
  );
};

export default backdrop;
