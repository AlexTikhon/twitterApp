import { Fragment, type ReactNode } from 'react';

import './Layout.css';

type LayoutProps = {
  header: ReactNode;
  mobileNav: ReactNode;
  children?: ReactNode;
};

const layout = (props: LayoutProps) => (
  <Fragment>
    <header className="main-header">{props.header}</header>
    {props.mobileNav}
    <main className="content">{props.children}</main>
  </Fragment>
);

export default layout;
