// Shows application errors inside the shared modal UI.
import React, { Fragment } from 'react';

import Backdrop from '../Backdrop/Backdrop';
import Modal from '../Modal/Modal';

type ErrorHandlerProps = {
  error: Error | null;
  onHandle: () => void;
};

// Shows a modal error dialog whenever an error object is present.
const errorHandler = (props: ErrorHandlerProps) => (
  <Fragment>
    {props.error && <Backdrop onClick={props.onHandle} />}
    {props.error && (
      <Modal
        title="An Error Occurred"
        onCancelModal={props.onHandle}
        onAcceptModal={props.onHandle}
        acceptEnabled
      >
        <p>{props.error.message}</p>
      </Modal>
    )}
  </Fragment>
);

export default errorHandler;
