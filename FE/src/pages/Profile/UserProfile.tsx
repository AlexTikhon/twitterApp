import { useQuery } from '@apollo/client';
import { useParams } from 'react-router-dom';

import FeedList from '../../components/Feed/FeedList/FeedList';
import Loader from '../../components/Loader/Loader';
import { GetUserDocument } from '../../generated/graphql';
import { useFeedPosts } from '../../hooks/useFeedPosts';
import { useInfiniteScroll } from '../../hooks/useInfiniteScroll';
import './UserProfile.css';

type UserProfileProps = {
  currentUserId: string;
};

const UserProfile = ({ currentUserId }: UserProfileProps) => {
  const { userId } = useParams();
  const profile = useQuery(GetUserDocument, {
    variables: { id: userId || '' },
    skip: !userId
  });
  const posts = useFeedPosts(userId);
  const sentinelRef = useInfiniteScroll(posts.hasNextPage && !posts.loadingMore, posts.loadMore);

  if (!userId) {
    return <p role="alert">User not found.</p>;
  }
  if (profile.loading) {
    return (
      <div className="profile__state" role="status">
        <Loader />
        <p>Loading profile...</p>
      </div>
    );
  }
  if (profile.error || !profile.data) {
    return (
      <section className="profile__state" role="alert">
        <h1>Could not load profile</h1>
        <p>{profile.error?.message || 'User not found.'}</p>
      </section>
    );
  }

  return (
    <section className="profile">
      <header className="profile__header">
        <h1>{profile.data.user.name}</h1>
        <p>{profile.data.user.status}</p>
        {currentUserId === profile.data.user._id && (
          <span className="profile__you">Your profile</span>
        )}
      </header>
      <h2>Posts</h2>
      {posts.error ? (
        <p role="alert">{posts.error.message}</p>
      ) : (
        <FeedList
          posts={posts.posts}
          loading={posts.loading}
          userId={currentUserId}
          hasNextPage={posts.hasNextPage}
          loadingMore={posts.loadingMore}
          sentinelRef={sentinelRef}
          onLoadMore={() => void posts.loadMore()}
        />
      )}
    </section>
  );
};

export default UserProfile;
