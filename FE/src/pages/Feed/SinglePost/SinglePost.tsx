// Loads a single post view from GraphQL using the route post id.
import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

import Image from '../../../components/Image/Image';
import { graphqlRequest, isUnauthorizedError } from '../../../util/graphql';
import './SinglePost.css';

type SinglePostProps = {
  token: string | null;
  userId?: string | null;
  onLogout: () => void;
};

type LoadedPost = {
  title: string;
  author: string;
  date: string;
  image: string;
  content: string;
};

type PostResponse = {
  post: {
    title: string;
    content: string;
    imageUrl: string;
    createdAt: string;
    creator: {
      name: string;
    };
  };
};

const SinglePost = (props: SinglePostProps) => {
  const { token, onLogout } = props;
  const { postId } = useParams();
  const [post, setPost] = useState<LoadedPost>({
    title: '',
    author: '',
    date: '',
    image: '',
    content: ''
  });

  // Loads one post by id and maps the GraphQL response into display state.
  const loadPost = useCallback(async () => {
    if (!postId) {
      return;
    }

    try {
      const data = await graphqlRequest<PostResponse>({
        query: `
          query GetPost($id: ID!) {
            post(id: $id) {
              title
              content
              imageUrl
              createdAt
              creator {
                name
              }
            }
          }
        `,
        variables: {
          id: postId
        },
        token
      });
      setPost({
        title: data.post.title,
        author: data.post.creator.name,
        date: new Date(data.post.createdAt).toLocaleDateString('en-US'),
        image: data.post.imageUrl,
        content: data.post.content
      });
    } catch (err) {
      console.log(err);
      if (isUnauthorizedError(err)) {
        onLogout();
      }
    }
  }, [onLogout, postId, token]);

  // Fetches the post details once the route parameter is available.
  useEffect(() => {
    loadPost();
  }, [loadPost]);

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
