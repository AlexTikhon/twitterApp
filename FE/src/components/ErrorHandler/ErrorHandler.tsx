import { Fragment } from 'react';

import Backdrop from '../Backdrop/Backdrop';
import Modal from '../Modal/Modal';

type ErrorHandlerProps = {
  error: Error | null;
  onHandle: () => void;
};

const errorHandler = (props: ErrorHandlerProps) => (
  <Fragment>
    {props.error && <Backdrop onClick={props.onHandle} />}
    {props.error && (
      <Modal
        title="An Error Occurred"
        onCancelModal={props.onHandle}
        onAcceptModal={props.onHandle}
        acceptEnabled
        role="alertdialog"
      >
        <p>{props.error.message}</p>
      </Modal>
    )}
  </Fragment>
);

export default errorHandler;
