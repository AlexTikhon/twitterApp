// Hamburger button that toggles the mobile navigation drawer.
import React from 'react';

import './MobileToggle.css';

type MobileToggleProps = {
  onOpen: () => void;
};

// Renders the hamburger control that opens the mobile navigation.
const mobileToggle = (props: MobileToggleProps) => (
  <button className="mobile-toggle" onClick={props.onOpen} aria-label="Open navigation">
    <span className="mobile-toggle__bar" />
    <span className="mobile-toggle__bar" />
    <span className="mobile-toggle__bar" />
  </button>
);

export default mobileToggle;
