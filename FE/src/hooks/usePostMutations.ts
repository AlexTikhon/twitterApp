import { useApolloClient, useMutation } from '@apollo/client';
import { useCallback, useRef, useState } from 'react';

import {
  CreatePostDocument,
  DeletePostDocument,
  GetPostsDocument,
  UpdatePostDocument
} from '../generated/graphql';
import type { PostEditorData } from '../components/Feed/FeedEdit/FeedEdit';
import { uploadImage } from '../util/upload';

// `completed` means the change is persisted; `refreshFailed` only says the feed is stale.
export type MutationOutcome =
  { status: 'ignored' } | { status: 'completed'; refreshFailed: boolean };

export const usePostMutations = () => {
  const client = useApolloClient();
  const [createPost] = useMutation(CreatePostDocument);
  const [updatePost] = useMutation(UpdatePostDocument);
  const [deletePost] = useMutation(DeletePostDocument);
  // Refs close the window before React re-renders with the pending state.
  const saveInFlight = useRef(false);
  const deleteInFlight = useRef(false);
  const refreshInFlight = useRef<Promise<boolean> | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [feedRefreshFailed, setFeedRefreshFailed] = useState(false);

  // Refetches the active feeds without repeating any mutation. Returns whether the feed is fresh.
  const refreshFeed = useCallback((): Promise<boolean> => {
    if (refreshInFlight.current) {
      return refreshInFlight.current;
    }

    setRefreshing(true);
    const refresh = client
      .refetchQueries({ include: [GetPostsDocument] })
      .then(
        () => true,
        () => false
      )
      .then((refreshed) => {
        setFeedRefreshFailed(!refreshed);
        return refreshed;
      })
      .finally(() => {
        refreshInFlight.current = null;
        setRefreshing(false);
      });
    refreshInFlight.current = refresh;
    return refresh;
  }, [client]);

  const savePost = async (postData: PostEditorData, postId?: string): Promise<MutationOutcome> => {
    if (saveInFlight.current) {
      return { status: 'ignored' };
    }

    saveInFlight.current = true;
    setSaving(true);
    try {
      const imageUploadId = postData.image ? await uploadImage(postData.image) : null;
      const postInput = {
        content: postData.content,
        imageUploadId,
        removeImage: postData.removeImage
      };

      if (postId) {
        await updatePost({ variables: { id: postId, postInput } });
        return { status: 'completed', refreshFailed: false };
      }

      await createPost({ variables: { postInput } });
      return { status: 'completed', refreshFailed: !(await refreshFeed()) };
    } finally {
      saveInFlight.current = false;
      setSaving(false);
    }
  };

  const removePost = async (postId: string): Promise<MutationOutcome> => {
    if (deleteInFlight.current) {
      return { status: 'ignored' };
    }

    deleteInFlight.current = true;
    setDeleting(true);
    try {
      await deletePost({
        variables: { id: postId },
        update: (cache) => {
          const cacheId = cache.identify({ __typename: 'Post', _id: postId });
          if (cacheId) {
            cache.evict({ id: cacheId });
            cache.gc();
          }
        }
      });
      return { status: 'completed', refreshFailed: !(await refreshFeed()) };
    } finally {
      deleteInFlight.current = false;
      setDeleting(false);
    }
  };

  return {
    savePost,
    removePost,
    refreshFeed,
    saving,
    deleting,
    refreshing,
    feedRefreshFailed
  };
};
