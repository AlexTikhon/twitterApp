// Global page shell with the header, mobile nav slot, and main content area.
import React, { Fragment } from 'react';

import './Layout.css';

type LayoutProps = {
  header: React.ReactNode;
  mobileNav: React.ReactNode;
  children?: React.ReactNode;
};

// Places the app header, mobile navigation, and page content into the shell.
const layout = (props: LayoutProps) => (
  <Fragment>
    <header className="main-header">{props.header}</header>
    {props.mobileNav}
    <main className="content">{props.children}</main>
  </Fragment>
);

export default layout;
