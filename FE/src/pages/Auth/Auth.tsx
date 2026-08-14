import type { ReactNode } from 'react';

import './Auth.css';

type AuthProps = {
  children: ReactNode;
};

const auth = (props: AuthProps) => <section className="auth-form">{props.children}</section>;

export default auth;
