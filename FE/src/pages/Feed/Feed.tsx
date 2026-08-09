// Owns the timeline UI, GraphQL feed operations, and realtime socket updates.
import React, { Fragment, useCallback, useEffect, useRef, useState } from 'react';

import Button from '../../components/Button/Button';
import FeedEdit from '../../components/Feed/FeedEdit/FeedEdit';
import type { PostEditorData } from '../../components/Feed/FeedEdit/FeedEdit';
import FeedList from '../../components/Feed/FeedList/FeedList';
import Input from '../../components/Form/Input/Input';
import ErrorHandler from '../../components/ErrorHandler/ErrorHandler';
import {
  CreatePostDocument,
  DeletePostDocument,
  GetPostsDocument,
  GetStatusDocument,
  UpdatePostDocument,
  UpdateStatusDocument
} from '../../generated/graphql';
import { usePostsRealtime } from '../../hooks/usePostsRealtime';
import { graphqlRequest, isUnauthorizedError } from '../../util/graphql';
import { uploadImage } from '../../util/upload';
import type { FeedPost, PostsRealtimeEvent } from './types';
import './Feed.css';

type FeedProps = {
  token: string | null;
  userId?: string | null;
  onLogout: () => void;
};

type FeedState = {
  isEditing: boolean;
  posts: readonly FeedPost[];
  editPost: FeedPost | null;
  status: string;
  cursorHistory: readonly (string | null)[];
  endCursor: string | null;
  hasNextPage: boolean;
  postsLoading: boolean;
  editLoading: boolean;
  error: Error | null;
};

const normalizeError = (error: unknown, fallbackMessage: string): Error =>
  error instanceof Error ? error : new Error(fallbackMessage);

const Feed = (props: FeedProps) => {
  const { token, userId, onLogout } = props;
  const deletedPostIds = useRef(new Set<string>());
  const [feedState, setFeedState] = useState<FeedState>({
    isEditing: false,
    posts: [],
    editPost: null,
    status: '',
    cursorHistory: [null],
    endCursor: null,
    hasNextPage: false,
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
        postsLoading: false,
        error: normalizeError(error, 'Feed request failed.')
      }));
    },
    [onLogout]
  );

  // Fetches one cursor page and records the cursors needed to navigate backwards.
  const fetchPosts = useCallback(
    async (after: string | null, cursorHistory: readonly (string | null)[]) => {
      try {
        const data = await graphqlRequest({
          document: GetPostsDocument,
          variables: {
            page: undefined,
            limit: undefined,
            first: 2,
            after: after || undefined
          }
        });

        setFeedState((prevState) => ({
          ...prevState,
          posts: data.posts.posts,
          cursorHistory,
          endCursor: data.posts.pageInfo.endCursor,
          hasNextPage: data.posts.pageInfo.hasNextPage,
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
      await fetchPosts(null, [null]);
    } catch (error) {
      catchError(error);
    }
  }, [catchError, fetchPosts]);

  const loadNextPage = async () => {
    if (!feedState.endCursor || !feedState.hasNextPage) {
      return;
    }
    const cursorHistory = [...feedState.cursorHistory, feedState.endCursor];
    setFeedState((prevState) => ({
      ...prevState,
      postsLoading: true,
      posts: []
    }));
    await fetchPosts(feedState.endCursor, cursorHistory);
  };

  const loadPreviousPage = async () => {
    if (feedState.cursorHistory.length <= 1) {
      return;
    }
    const cursorHistory = feedState.cursorHistory.slice(0, -1);
    const previousCursor = cursorHistory[cursorHistory.length - 1] || null;
    setFeedState((prevState) => ({ ...prevState, postsLoading: true, posts: [] }));
    await fetchPosts(previousCursor, cursorHistory);
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

      // Only the first page inserts the new item immediately into the visible list.
      if (prevState.cursorHistory.length !== 1) {
        return prevState;
      }

      return {
        ...prevState,
        posts: [post, ...prevState.posts].slice(0, 2)
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

      if (!postExists) {
        return { ...prevState, postsLoading: false };
      }

      return {
        ...prevState,
        posts: prevState.posts.filter((post) => post._id !== postId),
        postsLoading: false
      };
    });
  }, []);

  const handleRealtimeEvent = useCallback(
    (event: PostsRealtimeEvent) => {
      if (event.action === 'create') {
        if (feedState.cursorHistory.length === 1) {
          void fetchPosts(null, [null]);
        } else {
          addPost(event.post);
        }
        return;
      }
      if (event.action === 'update') {
        updatePost(event.post);
        return;
      }

      removePost(event.post._id);
      const currentCursor = feedState.cursorHistory[feedState.cursorHistory.length - 1] || null;
      void fetchPosts(currentCursor, feedState.cursorHistory);
    },
    [addPost, feedState.cursorHistory, fetchPosts, removePost, updatePost]
  );

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

  usePostsRealtime({
    token,
    onEvent: handleRealtimeEvent,
    onError: catchError,
    onUnauthorized: onLogout
  });

  // Loads profile and feed data when the authenticated feed mounts.
  useEffect(() => {
    void loadInitialData();
  }, [loadInitialData]);

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
        <FeedList
          posts={feedState.posts}
          loading={feedState.postsLoading}
          userId={userId}
          hasPreviousPage={feedState.cursorHistory.length > 1}
          hasNextPage={feedState.hasNextPage}
          onPreviousPage={() => void loadPreviousPage()}
          onNextPage={() => void loadNextPage()}
          onEdit={startEditPostHandler}
          onDelete={(postId) => void deletePostHandler(postId)}
        />
      </section>
    </Fragment>
  );
};

export default Feed;
