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

// Renders a file input and forwards selected image files to the parent form.
const filePicker = (props: FilePickerProps) => {
  const changeHandler = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (file && !file.type.startsWith('image/')) {
      event.target.value = '';
      props.onChange(props.id, '', null);
      return;
    }

    props.onChange(props.id, event.target.value, event.target.files);
  };

  return (
    <div className="input">
      <label htmlFor={props.id}>{props.label}</label>
      <input
        className={[
          !props.valid ? 'invalid' : 'valid',
          props.touched ? 'touched' : 'untouched'
        ].join(' ')}
        type="file"
        accept="image/png,image/jpeg"
        id={props.id}
        onChange={changeHandler}
        onBlur={props.onBlur}
      />
    </div>
  );
};

export default filePicker;
