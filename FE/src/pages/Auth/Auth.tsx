// Shared wrapper for the login and signup forms.
import React from 'react';

import './Auth.css';

type AuthProps = {
  children: React.ReactNode;
};

// Provides the shared layout wrapper for auth forms.
const auth = (props: AuthProps) => (
  <section className="auth-form">{props.children}</section>
);

export default auth;
