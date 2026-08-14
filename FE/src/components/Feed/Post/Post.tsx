import { Link } from 'react-router-dom';

import Button from '../../Button/Button';
import Image from '../../Image/Image';
import './Post.css';

type PostProps = {
  id: string;
  authorId: string;
  author: string;
  date: string;
  image?: string | null;
  content: string;
  canModify: boolean;
  deleting?: boolean;
  onStartEdit: () => void;
  onDelete: () => void;
};

const Post = (props: PostProps) => (
  <article className="post">
    <header className="post__header">
      <p className="post__meta">
        Posted by <Link to={`/users/${props.authorId}`}>{props.author}</Link> on {props.date}
      </p>
    </header>
    <p className="post__content">{props.content}</p>
    {props.image && (
      <div className="post__image">
        <Image imageUrl={props.image} alt={`Image attached to ${props.author}'s post`} />
      </div>
    )}
    <div className="post__actions">
      <Button mode="flat" link={`/posts/${props.id}`}>
        View
      </Button>
      {props.canModify && (
        <Button mode="flat" onClick={props.onStartEdit} disabled={props.deleting}>
          Edit
        </Button>
      )}
      {props.canModify && (
        <Button mode="flat" design="danger" onClick={props.onDelete} loading={props.deleting}>
          Delete
        </Button>
      )}
    </div>
  </article>
);

export default Post;
