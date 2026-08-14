import { NetworkStatus, useApolloClient, useQuery } from '@apollo/client';
import { useCallback, useRef } from 'react';

import { GetPostsDocument, PostFieldsFragmentDoc, type GetPostsQuery } from '../generated/graphql';
import type { FeedPost, PostsRealtimeEvent } from '../pages/Feed/types';

const PAGE_SIZE = 10;

const mergePosts = (current: readonly FeedPost[], incoming: readonly FeedPost[]) => {
  const posts = new Map(current.map((post) => [post._id, post]));
  incoming.forEach((post) => posts.set(post._id, post));
  return [...posts.values()];
};

export const useFeedPosts = (creatorId?: string) => {
  const client = useApolloClient();
  const loadingMore = useRef(false);
  const query = useQuery(GetPostsDocument, {
    variables: { first: PAGE_SIZE, after: null, creatorId: creatorId || null },
    notifyOnNetworkStatusChange: true
  });

  const loadMore = useCallback(async () => {
    const pageInfo = query.data?.posts.pageInfo;
    if (loadingMore.current || !pageInfo?.hasNextPage || !pageInfo.endCursor) {
      return;
    }

    loadingMore.current = true;
    try {
      await query.fetchMore({
        variables: { after: pageInfo.endCursor },
        updateQuery: (previous, { fetchMoreResult }) => {
          if (!fetchMoreResult) {
            return previous;
          }

          return {
            posts: {
              ...fetchMoreResult.posts,
              posts: mergePosts(previous.posts.posts, fetchMoreResult.posts.posts)
            }
          } satisfies GetPostsQuery;
        }
      });
    } finally {
      loadingMore.current = false;
    }
  }, [query]);

  const applyRealtimeEvent = useCallback(
    (event: PostsRealtimeEvent) => {
      if (event.action === 'create') {
        void client.refetchQueries({ include: [GetPostsDocument] });
        return;
      }

      if (event.action === 'delete') {
        const cacheId = client.cache.identify({ __typename: 'Post', _id: event.post._id });
        if (cacheId) {
          client.cache.evict({ id: cacheId });
          client.cache.gc();
        }
        return;
      }

      client.cache.writeFragment({
        id: client.cache.identify({ __typename: 'Post', _id: event.post._id }),
        fragment: PostFieldsFragmentDoc,
        data: event.post
      });
    },
    [client]
  );

  return {
    posts: query.data?.posts.posts || [],
    totalItems: query.data?.posts.totalItems || 0,
    hasNextPage: query.data?.posts.pageInfo.hasNextPage || false,
    loading: query.loading && query.networkStatus !== NetworkStatus.fetchMore,
    loadingMore: query.networkStatus === NetworkStatus.fetchMore,
    error: query.error,
    loadMore,
    applyRealtimeEvent
  };
};
