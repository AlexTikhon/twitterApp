// Specialized input for selecting an image file in the post editor.
import React from 'react';

import './Input.css';

type FilePickerProps = {
  id: string;
  label: string;
  control?: 'input';
  valid?: boolean;
  touched?: boolean;
  onChange: (id: string, value: string, files?: FileList | null) => void;
  onBlur?: React.FocusEventHandler<HTMLInputElement>;
};

// Renders a file input and forwards selected files to the parent form.
const filePicker = (props: FilePickerProps) => (
  <div className="input">
    <label htmlFor={props.id}>{props.label}</label>
    <input
      className={[
        !props.valid ? 'invalid' : 'valid',
        props.touched ? 'touched' : 'untouched'
      ].join(' ')}
      type="file"
      id={props.id}
      onChange={e => props.onChange(props.id, e.target.value, e.target.files)}
      onBlur={props.onBlur}
    />
  </div>
);

export default filePicker;
