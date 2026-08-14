import { Fragment, useCallback, useEffect, useState, type FormEvent } from 'react';

import Button from '../../components/Button/Button';
import ErrorHandler from '../../components/ErrorHandler/ErrorHandler';
import FeedEdit, { type PostEditorData } from '../../components/Feed/FeedEdit/FeedEdit';
import FeedList from '../../components/Feed/FeedList/FeedList';
import Input from '../../components/Form/Input/Input';
import { useCurrentUserStatus } from '../../hooks/useCurrentUserStatus';
import { useFeedPosts } from '../../hooks/useFeedPosts';
import { useInfiniteScroll } from '../../hooks/useInfiniteScroll';
import { usePostMutations } from '../../hooks/usePostMutations';
import type { FeedPost } from './types';
import './Feed.css';

type FeedProps = {
  userId?: string | null;
};

const asError = (error: unknown, fallback: string) =>
  error instanceof Error ? error : new Error(fallback);

const Feed = ({ userId }: FeedProps) => {
  const feed = useFeedPosts();
  const profileStatus = useCurrentUserStatus();
  const postMutations = usePostMutations();
  const [editorPost, setEditorPost] = useState<FeedPost | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const sentinelRef = useInfiniteScroll(feed.hasNextPage && !feed.loadingMore, feed.loadMore);

  const reportError = useCallback((caught: unknown) => {
    setError(asError(caught, 'Feed request failed.'));
  }, []);

  useEffect(() => {
    if (feed.error || profileStatus.error) {
      reportError(feed.error || profileStatus.error);
    }
  }, [feed.error, profileStatus.error, reportError]);

  const finishEdit = async (postData: PostEditorData) => {
    try {
      await postMutations.savePost(postData, editorPost?._id);
      setIsEditing(false);
      setEditorPost(null);
    } catch (caught) {
      reportError(caught);
      throw caught;
    }
  };

  const deletePost = async (postId: string) => {
    if (deletingPostId) {
      return;
    }

    setDeletingPostId(postId);
    try {
      await postMutations.removePost(postId);
    } catch (caught) {
      reportError(caught);
    } finally {
      setDeletingPostId(null);
    }
  };

  const updateStatus = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      await profileStatus.saveStatus();
    } catch (caught) {
      reportError(caught);
    }
  };

  return (
    <Fragment>
      <ErrorHandler error={error} onHandle={() => setError(null)} />
      <FeedEdit
        editing={isEditing}
        selectedPost={editorPost}
        loading={postMutations.saving}
        onCancelEdit={() => {
          setIsEditing(false);
          setEditorPost(null);
        }}
        onFinishEdit={finishEdit}
      />
      <section className="feed__status" aria-label="Profile status">
        <form onSubmit={updateStatus}>
          <Input
            id="status"
            type="text"
            required
            ariaLabel="Your profile status"
            placeholder="Your status"
            control="input"
            maxLength={160}
            onChange={(_input, value) => profileStatus.setStatus(value)}
            value={profileStatus.status}
          />
          <Button mode="flat" type="submit" loading={profileStatus.loading}>
            Update
          </Button>
        </form>
      </section>
      <section className="feed__control">
        <Button mode="raised" design="accent" onClick={() => setIsEditing(true)}>
          New Post
        </Button>
      </section>
      <section className="feed" aria-label="Post feed">
        <FeedList
          posts={feed.posts}
          loading={feed.loading}
          userId={userId}
          hasNextPage={feed.hasNextPage}
          loadingMore={feed.loadingMore}
          deletingPostId={deletingPostId}
          sentinelRef={sentinelRef}
          onLoadMore={() => void feed.loadMore()}
          onEdit={(postId) => {
            setEditorPost(feed.posts.find((post) => post._id === postId) || null);
            setIsEditing(true);
          }}
          onDelete={(postId) => void deletePost(postId)}
        />
      </section>
    </Fragment>
  );
};

export default Feed;
