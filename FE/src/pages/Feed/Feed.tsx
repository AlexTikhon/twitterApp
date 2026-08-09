// Owns the timeline UI, GraphQL feed operations, and realtime socket updates.
import React, { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import openSocket, { Socket } from 'socket.io-client';

import Post from '../../components/Feed/Post/Post';
import Button from '../../components/Button/Button';
import FeedEdit from '../../components/Feed/FeedEdit/FeedEdit';
import type { PostEditorData } from '../../components/Feed/FeedEdit/FeedEdit';
import Input from '../../components/Form/Input/Input';
import Paginator from '../../components/Paginator/Paginator';
import Loader from '../../components/Loader/Loader';
import ErrorHandler from '../../components/ErrorHandler/ErrorHandler';
import { API_URL } from '../../config';
import type { GetPostsQuery } from '../../generated/graphql';
import {
  CreatePostDocument,
  DeletePostDocument,
  GetPostsDocument,
  GetStatusDocument,
  UpdatePostDocument,
  UpdateStatusDocument
} from '../../generated/graphql';
import { graphqlRequest, isUnauthorizedError } from '../../util/graphql';
import { uploadImage } from '../../util/upload';
import './Feed.css';

type FeedProps = {
  token: string | null;
  userId?: string | null;
  onLogout: () => void;
};

type FeedPost = GetPostsQuery['posts']['posts'][number];

type FeedState = {
  isEditing: boolean;
  posts: readonly FeedPost[];
  totalPosts: number;
  editPost: FeedPost | null;
  status: string;
  postPage: number;
  postsLoading: boolean;
  editLoading: boolean;
  error: Error | null;
};

type LoadDirection = 'next' | 'previous';

type PostsSocketEvent =
  | { action: 'create'; post: FeedPost }
  | { action: 'update'; post: FeedPost }
  | { action: 'delete'; post: Pick<FeedPost, '_id'> };

const normalizeError = (error: unknown, fallbackMessage: string): Error =>
  error instanceof Error ? error : new Error(fallbackMessage);

const Feed = (props: FeedProps) => {
  const { token, userId, onLogout } = props;
  const socket = useRef<Socket | null>(null);
  const deletedPostIds = useRef(new Set<string>());
  const [feedState, setFeedState] = useState<FeedState>({
    isEditing: false,
    posts: [],
    totalPosts: 0,
    editPost: null,
    status: '',
    postPage: 1,
    postsLoading: true,
    editLoading: false,
    error: null
  });

  // Stores a caught request error so the shared error modal can show it.
  const catchError = useCallback(
    (error: unknown) => {
      if (isUnauthorizedError(error)) {
        onLogout();
        return;
      }

      setFeedState((prevState) => ({
        ...prevState,
        error: normalizeError(error, 'Feed request failed.')
      }));
    },
    [onLogout]
  );

  // Fetches one explicit page so initial loading does not depend on stale state.
  const fetchPosts = useCallback(
    async (page: number) => {
      try {
        const data = await graphqlRequest({
          document: GetPostsDocument,
          variables: { page, limit: 2, first: undefined, after: undefined }
        });

        setFeedState((prevState) => ({
          ...prevState,
          posts: data.posts.posts,
          totalPosts: data.posts.totalItems,
          postPage: page,
          postsLoading: false
        }));
      } catch (error) {
        catchError(error);
      }
    },
    [catchError]
  );

  // Loads status first, then loads the initial posts page.
  const loadInitialData = useCallback(async () => {
    try {
      const data = await graphqlRequest({
        document: GetStatusDocument
      });

      setFeedState((prevState) => ({ ...prevState, status: data.status.status }));
      // The status query and first posts query are separated to keep the UI responsive.
      await fetchPosts(1);
    } catch (error) {
      catchError(error);
    }
  }, [catchError, fetchPosts]);

  // Loads the current, next, or previous page of posts from GraphQL.
  const loadPosts = async (direction: LoadDirection) => {
    const page = direction === 'next' ? feedState.postPage + 1 : feedState.postPage - 1;

    setFeedState((prevState) => ({
      ...prevState,
      postsLoading: true,
      posts: [],
      postPage: page
    }));

    await fetchPosts(page);
  };

  // Persists the edited profile status for the current user.
  const statusUpdateHandler = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      const data = await graphqlRequest({
        document: UpdateStatusDocument,
        variables: {
          status: feedState.status
        }
      });

      setFeedState((prevState) => ({
        ...prevState,
        status: data.updateStatus.status
      }));
    } catch (error) {
      catchError(error);
    }
  };

  // Opens the post editor in create mode.
  const newPostHandler = () => {
    setFeedState((prevState) => ({ ...prevState, isEditing: true }));
  };

  // Inserts a socket-created post into the visible list when appropriate.
  const addPost = useCallback((post: FeedPost) => {
    setFeedState((prevState) => {
      const postAlreadyExists = prevState.posts.some(
        (existingPost) => existingPost._id === post._id
      );

      if (postAlreadyExists) {
        return prevState;
      }

      const totalPosts = prevState.totalPosts + 1;

      // Only the first page inserts the new item immediately into the visible list.
      if (prevState.postPage !== 1) {
        return { ...prevState, totalPosts };
      }

      return {
        ...prevState,
        posts: [post, ...prevState.posts].slice(0, 2),
        totalPosts
      };
    });
  }, []);

  // Replaces a visible post after an edit event or edit mutation succeeds.
  const updatePost = useCallback((post: FeedPost) => {
    setFeedState((prevState) => {
      const postIndex = prevState.posts.findIndex((existingPost) => existingPost._id === post._id);

      if (postIndex < 0) {
        return prevState;
      }

      const updatedPosts = [...prevState.posts];
      updatedPosts[postIndex] = post;

      return {
        ...prevState,
        posts: updatedPosts
      };
    });
  }, []);

  // Removes a post from local state and adjusts the total count.
  const removePost = useCallback((postId: string) => {
    setFeedState((prevState) => {
      if (deletedPostIds.current.has(postId)) {
        return { ...prevState, postsLoading: false };
      }

      deletedPostIds.current.add(postId);
      const postExists = prevState.posts.some((post) => post._id === postId);
      const totalPosts = Math.max(prevState.totalPosts - 1, 0);

      if (!postExists) {
        return {
          ...prevState,
          totalPosts
        };
      }

      return {
        ...prevState,
        posts: prevState.posts.filter((post) => post._id !== postId),
        totalPosts,
        postsLoading: false
      };
    });
  }, []);

  // Opens the post editor with the selected post prefilled.
  const startEditPostHandler = (postId: string) => {
    setFeedState((prevState) => {
      const loadedPost = prevState.posts.find((p) => p._id === postId) || null;

      return {
        ...prevState,
        isEditing: true,
        editPost: loadedPost
      };
    });
  };

  // Closes the post editor without saving changes.
  const cancelEditHandler = () => {
    setFeedState((prevState) => ({
      ...prevState,
      isEditing: false,
      editPost: null
    }));
  };

  // Creates or updates a post using the current editor payload.
  const finishEditHandler = async (postData: PostEditorData) => {
    const activeEditPost = feedState.editPost;
    const wasEditing = !!activeEditPost;

    setFeedState((prevState) => ({
      ...prevState,
      editLoading: true
    }));

    try {
      const imageUploadId = postData.image ? await uploadImage(postData.image, token) : null;
      const postInput = {
        title: postData.title,
        content: postData.content,
        imageUploadId
      };

      const post = activeEditPost
        ? (
            await graphqlRequest({
              document: UpdatePostDocument,
              variables: { id: activeEditPost._id, postInput }
            })
          ).updatePost
        : (
            await graphqlRequest({
              document: CreatePostDocument,
              variables: { postInput }
            })
          ).createPost;

      setFeedState((prevState) => {
        const updatedPosts = [...prevState.posts];
        if (activeEditPost) {
          const postIndex = prevState.posts.findIndex((p) => p._id === activeEditPost._id);
          if (postIndex >= 0) {
            updatedPosts[postIndex] = post;
          }
        }
        return {
          ...prevState,
          posts: updatedPosts,
          isEditing: false,
          editPost: null,
          editLoading: false
        };
      });

      if (!wasEditing) {
        addPost(post);
      } else {
        updatePost(post);
      }
    } catch (err) {
      console.log(err);
      if (isUnauthorizedError(err)) {
        onLogout();
        return;
      }

      setFeedState((prevState) => ({
        ...prevState,
        isEditing: false,
        editPost: null,
        editLoading: false,
        error: normalizeError(err, 'Could not save post.')
      }));
    }
  };

  // Mirrors the status input value into component state.
  const statusInputChangeHandler = (input: string, value: string) => {
    if (input !== 'status') {
      return;
    }
    setFeedState((prevState) => ({ ...prevState, [input]: value }));
  };

  // Deletes a post through GraphQL and removes it from local state.
  const deletePostHandler = async (postId: string) => {
    setFeedState((prevState) => ({ ...prevState, postsLoading: true }));
    try {
      await graphqlRequest({
        document: DeletePostDocument,
        variables: {
          id: postId
        }
      });
      removePost(postId);
    } catch (err) {
      console.log(err);
      if (isUnauthorizedError(err)) {
        onLogout();
        return;
      }

      setFeedState((prevState) => ({ ...prevState, postsLoading: false }));
    }
  };

  // Clears the feed-level error modal state.
  const errorHandler = () => {
    setFeedState((prevState) => ({ ...prevState, error: null }));
  };

  // Connects realtime post events and loads the initial feed data.
  useEffect(() => {
    if (!token) {
      onLogout();
      return;
    }

    socket.current = openSocket(API_URL, {
      auth: {
        token
      }
    });
    socket.current.on('connect_error', (error) => {
      if (error.message === 'Not authenticated.') {
        onLogout();
        return;
      }

      catchError(error);
    });
    // Socket events keep the visible page in sync after create, update, and delete actions.
    socket.current.on('posts', (data: PostsSocketEvent) => {
      if (data.action === 'create') {
        addPost(data.post);
      }
      if (data.action === 'update') {
        updatePost(data.post);
      }
      if (data.action === 'delete') {
        removePost(data.post._id);
      }
    });

    void loadInitialData();

    // Disconnects the socket subscription when the feed page unmounts.
    return () => {
      if (socket.current) {
        socket.current.disconnect();
      }
    };
  }, [addPost, catchError, loadInitialData, onLogout, removePost, token, updatePost]);

  // Renders the status form, editor modal, loading state, and paginated posts.
  return (
    <Fragment>
      <ErrorHandler error={feedState.error} onHandle={errorHandler} />
      <FeedEdit
        editing={feedState.isEditing}
        selectedPost={feedState.editPost}
        loading={feedState.editLoading}
        onCancelEdit={cancelEditHandler}
        onFinishEdit={finishEditHandler}
      />
      <section className="feed__status">
        <form onSubmit={statusUpdateHandler}>
          <Input
            id="status"
            type="text"
            placeholder="Your status"
            control="input"
            onChange={statusInputChangeHandler}
            value={feedState.status}
          />
          <Button mode="flat" type="submit">
            Update
          </Button>
        </form>
      </section>
      <section className="feed__control">
        <Button mode="raised" design="accent" onClick={newPostHandler}>
          New Post
        </Button>
      </section>
      <section className="feed">
        {feedState.postsLoading && (
          <div style={{ textAlign: 'center', marginTop: '2rem' }}>
            <Loader />
          </div>
        )}
        {feedState.posts.length <= 0 && !feedState.postsLoading ? (
          <p style={{ textAlign: 'center' }}>No posts found.</p>
        ) : null}
        {!feedState.postsLoading && (
          <Paginator
            onPrevious={() => loadPosts('previous')}
            onNext={() => loadPosts('next')}
            lastPage={Math.ceil(feedState.totalPosts / 2)}
            currentPage={feedState.postPage}
          >
            {feedState.posts.map((post) => (
              <Post
                key={post._id}
                id={post._id}
                author={post.creator.name}
                date={new Date(post.createdAt).toLocaleDateString('en-US')}
                title={post.title}
                image={post.imageUrl}
                content={post.content}
                canModify={post.creator._id === userId}
                onStartEdit={() => startEditPostHandler(post._id)}
                onDelete={() => deletePostHandler(post._id)}
              />
            ))}
          </Paginator>
        )}
      </section>
    </Fragment>
  );
};

export default Feed;
