import type { RefObject } from 'react';

import Button from '../../Button/Button';
import Loader from '../../Loader/Loader';
import Post from '../Post/Post';
import type { FeedPost } from '../../../pages/Feed/types';

type FeedListProps = {
  posts: readonly FeedPost[];
  loading: boolean;
  userId?: string | null;
  hasNextPage: boolean;
  loadingMore: boolean;
  deletingPostId?: string | null;
  sentinelRef: RefObject<HTMLDivElement | null>;
  onLoadMore: () => void;
  onEdit?: (postId: string) => void;
  onDelete?: (postId: string) => void;
};

const FeedList = ({
  posts,
  loading,
  userId,
  hasNextPage,
  loadingMore,
  deletingPostId,
  sentinelRef,
  onLoadMore,
  onEdit,
  onDelete
}: FeedListProps) => {
  if (loading && posts.length === 0) {
    return (
      <div className="feed__loading" role="status" aria-label="Loading posts">
        <Loader />
      </div>
    );
  }

  if (posts.length === 0) {
    return <p className="feed__empty">No posts found.</p>;
  }

  return (
    <>
      {posts.map((post) => (
        <Post
          key={post._id}
          id={post._id}
          authorId={post.creator._id}
          author={post.creator.name}
          date={new Date(post.createdAt).toLocaleDateString('en-US')}
          image={post.imageUrl}
          content={post.content}
          canModify={Boolean(onEdit && onDelete && post.creator._id === userId)}
          deleting={deletingPostId === post._id}
          onStartEdit={() => onEdit?.(post._id)}
          onDelete={() => onDelete?.(post._id)}
        />
      ))}
      <div ref={sentinelRef} className="feed__sentinel" aria-hidden="true" />
      {hasNextPage ? (
        <div className="feed__load-more">
          <Button onClick={onLoadMore} loading={loadingMore} disabled={loadingMore}>
            Load more posts
          </Button>
        </div>
      ) : (
        <p className="feed__end" role="status">
          You have reached the end of the feed.
        </p>
      )}
    </>
  );
};

export default FeedList;
