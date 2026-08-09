import type { GetPostsQuery } from '../../generated/graphql';

export type FeedPost = GetPostsQuery['posts']['posts'][number];

export type PostsRealtimeEvent =
  | { action: 'create'; post: FeedPost }
  | { action: 'update'; post: FeedPost }
  | { action: 'delete'; post: Pick<FeedPost, '_id'> };
