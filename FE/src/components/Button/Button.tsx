import { Link } from 'react-router-dom';
import type { MouseEventHandler, ReactNode } from 'react';

import './Button.css';

type ButtonProps = {
  children: ReactNode;
  design?: string;
  mode?: string;
  link?: string;
  loading?: boolean;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
  onClick?: MouseEventHandler<HTMLButtonElement>;
};

const button = (props: ButtonProps) =>
  !props.link ? (
    <button
      className={['button', `button--${props.design}`, `button--${props.mode}`].join(' ')}
      onClick={props.onClick}
      disabled={props.disabled || props.loading}
      type={props.type || 'button'}
      aria-busy={props.loading || undefined}
    >
      {props.loading ? 'Loading...' : props.children}
    </button>
  ) : (
    <Link
      className={['button', `button--${props.design}`, `button--${props.mode}`].join(' ')}
      to={props.link}
    >
      {props.children}
    </Link>
  );

export default button;
