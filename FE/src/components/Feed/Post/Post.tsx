// Renders the compact post card used inside the paginated feed list.
import React from 'react';

import Button from '../../Button/Button';
import './Post.css';

type PostProps = {
  id: string;
  author: string;
  date: string;
  title: string;
  image?: string;
  content?: string;
  onStartEdit: () => void;
  onDelete: () => void;
};

// Renders one feed post summary with view, edit, and delete actions.
const post = (props: PostProps) => (
  <article className="post">
    <header className="post__header">
      <h3 className="post__meta">
        Posted by {props.author} on {props.date}
      </h3>
      <h1 className="post__title">{props.title}</h1>
    </header>
    <div className="post__actions">
      <Button mode="flat" link={props.id}>
        View
      </Button>
      <Button mode="flat" onClick={props.onStartEdit}>
        Edit
      </Button>
      <Button mode="flat" design="danger" onClick={props.onDelete}>
        Delete
      </Button>
    </div>
  </article>
);

export default post;
