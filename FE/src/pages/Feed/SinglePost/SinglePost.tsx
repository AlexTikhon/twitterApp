// Loads a single post view from GraphQL using the route post id.
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

import Image from '../../../components/Image/Image';
import Loader from '../../../components/Loader/Loader';
import { GetPostDocument } from '../../../generated/graphql';
import { graphqlRequest, isUnauthorizedError } from '../../../util/graphql';
import './SinglePost.css';

type SinglePostProps = {
  onLogout: () => void;
};

type LoadedPost = {
  title: string;
  author: string;
  date: string;
  image: string;
  content: string;
};

const SinglePost = (props: SinglePostProps) => {
  const { onLogout } = props;
  const { postId } = useParams();
  const [post, setPost] = useState<LoadedPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Fetches the post details whenever the route id changes.
  useEffect(() => {
    let active = true;

    if (!postId) {
      setLoading(false);
      return () => {
        active = false;
      };
    }

    setPost(null);
    setError(null);
    setLoading(true);

    const loadPost = async () => {
      try {
        const data = await graphqlRequest({
          document: GetPostDocument,
          variables: {
            id: postId
          }
        });
        if (!active) {
          return;
        }

        setPost({
          title: data.post.title,
          author: data.post.creator.name,
          date: new Date(data.post.createdAt).toLocaleDateString('en-US'),
          image: data.post.imageUrl,
          content: data.post.content
        });
        setLoading(false);
      } catch (err) {
        if (!active) {
          return;
        }
        if (isUnauthorizedError(err)) {
          onLogout();
          return;
        }

        setError(err instanceof Error ? err : new Error('Could not load post.'));
        setLoading(false);
      }
    };

    void loadPost();

    return () => {
      active = false;
    };
  }, [onLogout, postId]);

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

  if (!post) {
    return (
      <section className="single-post single-post__state">
        <h1>Post not found.</h1>
      </section>
    );
  }

  // Renders the loaded post details.
  return (
    <section className="single-post">
      <h1>{post.title}</h1>
      <h2>
        Created by {post.author} on {post.date}
      </h2>
      <div className="single-post__image">
        <Image contain imageUrl={post.image} />
      </div>
      <p>{post.content}</p>
    </section>
  );
};

export default SinglePost;
