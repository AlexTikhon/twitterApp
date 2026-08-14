import type { FocusEventHandler } from 'react';

import './Input.css';

type InputProps = {
  id: string;
  control: 'input' | 'textarea';
  label?: string;
  ariaLabel?: string;
  type?: string;
  required?: boolean;
  value?: string;
  placeholder?: string;
  rows?: string;
  maxLength?: number;
  valid?: boolean;
  touched?: boolean;
  onChange: (id: string, value: string, files?: FileList | null) => void;
  onBlur?: FocusEventHandler<HTMLInputElement | HTMLTextAreaElement>;
};

const input = (props: InputProps) => (
  <div className="input">
    {props.label && <label htmlFor={props.id}>{props.label}</label>}
    {props.control === 'input' && (
      <input
        className={[
          !props.valid ? 'invalid' : 'valid',
          props.touched ? 'touched' : 'untouched'
        ].join(' ')}
        type={props.type}
        id={props.id}
        required={props.required}
        value={props.value}
        placeholder={props.placeholder}
        aria-label={props.ariaLabel}
        aria-invalid={props.touched && props.valid === false}
        onChange={(e) => props.onChange(props.id, e.target.value, e.target.files)}
        onBlur={props.onBlur}
        maxLength={props.maxLength}
      />
    )}
    {props.control === 'textarea' && (
      <textarea
        className={[
          !props.valid ? 'invalid' : 'valid',
          props.touched ? 'touched' : 'untouched'
        ].join(' ')}
        id={props.id}
        rows={props.rows ? Number(props.rows) : undefined}
        required={props.required}
        value={props.value}
        aria-label={props.ariaLabel}
        aria-invalid={props.touched && props.valid === false}
        onChange={(e) => props.onChange(props.id, e.target.value)}
        onBlur={props.onBlur}
        maxLength={props.maxLength}
      />
    )}
  </div>
);

export default input;
