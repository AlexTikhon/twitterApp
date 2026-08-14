import { useQuery } from '@apollo/client';
import { Link, useParams } from 'react-router-dom';

import Image from '../../../components/Image/Image';
import Loader from '../../../components/Loader/Loader';
import { GetPostDocument } from '../../../generated/graphql';
import './SinglePost.css';

const SinglePost = () => {
  const { postId } = useParams();
  const { data, loading, error } = useQuery(GetPostDocument, {
    variables: { id: postId || '' },
    skip: !postId
  });

  if (!postId) {
    return (
      <section className="single-post single-post__state">
        <h1>Post not found.</h1>
      </section>
    );
  }

  if (loading) {
    return (
      <section className="single-post single-post__state" role="status">
        <Loader />
        <p>Loading post...</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="single-post single-post__state" role="alert">
        <h1>Could not load post</h1>
        <p>{error.message}</p>
      </section>
    );
  }

  if (!data) {
    return (
      <section className="single-post single-post__state">
        <h1>Post not found.</h1>
      </section>
    );
  }

  const post = data.post;
  return (
    <article className="single-post">
      <h1>Post by {post.creator.name}</h1>
      <p className="single-post__meta">
        <Link to={`/users/${post.creator._id}`}>{post.creator.name}</Link> ·{' '}
        {new Date(post.createdAt).toLocaleDateString('en-US')}
      </p>
      {post.imageUrl && (
        <div className="single-post__image">
          <Image contain imageUrl={post.imageUrl} alt={`Image attached by ${post.creator.name}`} />
        </div>
      )}
      <p className="single-post__content">{post.content}</p>
    </article>
  );
};

export default SinglePost;
