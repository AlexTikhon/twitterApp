// Wraps feed content with previous/next controls for the current page.
import React from 'react';

import './Paginator.css';

type PaginatorProps = {
  children: React.ReactNode;
  hasPrevious: boolean;
  hasNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
};

// Wraps page content and shows previous/next controls when available.
const paginator = (props: PaginatorProps) => (
  <div className="paginator">
    {props.children}
    <div className="paginator__controls">
      {props.hasPrevious && (
        <button className="paginator__control" onClick={props.onPrevious}>
          Previous
        </button>
      )}
      {props.hasNext && (
        <button className="paginator__control" onClick={props.onNext}>
          Next
        </button>
      )}
    </div>
  </div>
);

export default paginator;
