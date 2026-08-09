import Loader from '../../Loader/Loader';
import Paginator from '../../Paginator/Paginator';
import Post from '../Post/Post';
import type { FeedPost } from '../../../pages/Feed/types';

type FeedListProps = {
  posts: readonly FeedPost[];
  loading: boolean;
  userId: string | null | undefined;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
  deletingPostId: string | null;
  onPreviousPage: () => void;
  onNextPage: () => void;
  onEdit: (postId: string) => void;
  onDelete: (postId: string) => void;
};

const FeedList = ({
  posts,
  loading,
  userId,
  hasPreviousPage,
  hasNextPage,
  deletingPostId,
  onPreviousPage,
  onNextPage,
  onEdit,
  onDelete
}: FeedListProps) => {
  if (loading) {
    return (
      <div style={{ textAlign: 'center', marginTop: '2rem' }}>
        <Loader />
      </div>
    );
  }

  if (posts.length === 0) {
    return <p style={{ textAlign: 'center' }}>No posts found.</p>;
  }

  return (
    <Paginator
      hasPrevious={hasPreviousPage}
      hasNext={hasNextPage}
      onPrevious={onPreviousPage}
      onNext={onNextPage}
    >
      {posts.map((post) => (
        <Post
          key={post._id}
          id={post._id}
          author={post.creator.name}
          date={new Date(post.createdAt).toLocaleDateString('en-US')}
          title={post.title}
          image={post.imageUrl}
          content={post.content}
          canModify={post.creator._id === userId}
          deleting={deletingPostId === post._id}
          onStartEdit={() => onEdit(post._id)}
          onDelete={() => onDelete(post._id)}
        />
      ))}
    </Paginator>
  );
};

export default FeedList;
