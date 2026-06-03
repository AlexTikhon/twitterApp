// Hamburger button that toggles the mobile navigation drawer.
import React from 'react';

import './MobileToggle.css';

// Renders the hamburger control that opens the mobile navigation.
const mobileToggle = props => (
  <button className="mobile-toggle" onClick={props.onOpen}>
    <span className="mobile-toggle__bar" />
    <span className="mobile-toggle__bar" />
    <span className="mobile-toggle__bar" />
  </button>
);

export default mobileToggle;
