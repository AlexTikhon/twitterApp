// Wraps feed content with previous/next controls for the current page.
import React from 'react';

import './Paginator.css';

type PaginatorProps = {
  children: React.ReactNode;
  currentPage: number;
  lastPage: number;
  onPrevious: () => void;
  onNext: () => void;
};

// Wraps page content and shows previous/next controls when available.
const paginator = (props: PaginatorProps) => (
  <div className="paginator">
    {props.children}
    <div className="paginator__controls">
      {props.currentPage > 1 && (
        <button className="paginator__control" onClick={props.onPrevious}>
          Previous
        </button>
      )}
      {props.currentPage < props.lastPage && (
        <button className="paginator__control" onClick={props.onNext}>
          Next
        </button>
      )}
    </div>
  </div>
);

export default paginator;
