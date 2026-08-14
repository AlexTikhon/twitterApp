import { NetworkStatus, useQuery } from '@apollo/client';
import { useCallback, useEffect, useRef, useState } from 'react';

import { GetPostsDocument, type GetPostsQuery } from '../generated/graphql';
import type { FeedPost } from '../pages/Feed/types';

const PAGE_SIZE = 10;

const mergePosts = (current: readonly FeedPost[], incoming: readonly FeedPost[]) => {
  const posts = new Map(current.map((post) => [post._id, post]));
  incoming.forEach((post) => posts.set(post._id, post));
  return [...posts.values()];
};

export const useFeedPosts = (creatorId?: string) => {
  const fetchMoreInFlight = useRef(false);
  const [paginationError, setPaginationError] = useState<Error | null>(null);
  const query = useQuery(GetPostsDocument, {
    variables: { first: PAGE_SIZE, after: null, creatorId: creatorId || null },
    notifyOnNetworkStatusChange: true
  });

  useEffect(() => setPaginationError(null), [creatorId]);

  const loadMore = useCallback(async () => {
    const pageInfo = query.data?.posts.pageInfo;
    if (fetchMoreInFlight.current || !pageInfo?.hasNextPage || !pageInfo.endCursor) {
      return;
    }

    fetchMoreInFlight.current = true;
    setPaginationError(null);
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
    } catch (error) {
      setPaginationError(error instanceof Error ? error : new Error('Could not load more posts.'));
    } finally {
      fetchMoreInFlight.current = false;
    }
  }, [query]);

  return {
    posts: query.data?.posts.posts || [],
    totalItems: query.data?.posts.totalItems || 0,
    hasNextPage: query.data?.posts.pageInfo.hasNextPage || false,
    loading: query.loading && query.networkStatus !== NetworkStatus.fetchMore,
    loadingMore: query.networkStatus === NetworkStatus.fetchMore,
    error: query.error || paginationError,
    loadMore
  };
};
