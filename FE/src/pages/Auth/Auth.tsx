// Shared wrapper for the login and signup forms.
import React from 'react';

import './Auth.css';

// Provides the shared layout wrapper for auth forms.
const auth = props => <section className="auth-form">{props.children}</section>;

export default auth;
