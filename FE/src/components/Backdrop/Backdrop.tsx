// Shared overlay rendered through a portal behind modals and mobile navigation.
import React from 'react';
import ReactDOM from 'react-dom';

import './Backdrop.css';

// Renders a clickable overlay into the dedicated backdrop portal root.
const backdrop = props =>
  ReactDOM.createPortal(
    <div
      className={['backdrop', props.open ? 'open' : ''].join(' ')}
      onClick={props.onClick}
    />,
    document.getElementById('backdrop-root')
  );

export default backdrop;
