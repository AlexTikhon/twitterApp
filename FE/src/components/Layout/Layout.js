// Global page shell with the header, mobile nav slot, and main content area.
import React, { Fragment } from 'react';

import './Layout.css';

const layout = props => (
  <Fragment>
    <header className="main-header">{props.header}</header>
    {props.mobileNav}
    <main className="content">{props.children}</main>
  </Fragment>
);

export default layout;
