// Generic form control used by auth forms, status input, and post editor fields.
import React from 'react';

import './Input.css';

type InputProps = {
  id: string;
  control: 'input' | 'textarea';
  label?: string;
  type?: string;
  required?: boolean;
  value?: string;
  placeholder?: string;
  rows?: string;
  valid?: boolean;
  touched?: boolean;
  onChange: (id: string, value: string, files?: FileList | null) => void;
  onBlur?: React.FocusEventHandler<HTMLInputElement | HTMLTextAreaElement>;
};

// Renders either a text input or textarea with validation styling.
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
        onChange={(e) => props.onChange(props.id, e.target.value, e.target.files)}
        onBlur={props.onBlur}
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
        onChange={(e) => props.onChange(props.id, e.target.value)}
        onBlur={props.onBlur}
      />
    )}
  </div>
);

export default input;
