import { useMutation } from '@apollo/client';

import {
  CreatePostDocument,
  DeletePostDocument,
  GetPostsDocument,
  UpdatePostDocument
} from '../generated/graphql';
import type { PostEditorData } from '../components/Feed/FeedEdit/FeedEdit';
import { uploadImage } from '../util/upload';

export const usePostMutations = () => {
  const [createPost, createState] = useMutation(CreatePostDocument);
  const [updatePost, updateState] = useMutation(UpdatePostDocument);
  const [deletePost, deleteState] = useMutation(DeletePostDocument);

  const savePost = async (postData: PostEditorData, postId?: string) => {
    const imageUploadId = postData.image ? await uploadImage(postData.image) : null;
    const postInput = {
      content: postData.content,
      imageUploadId,
      removeImage: postData.removeImage
    };

    if (postId) {
      return (
        await updatePost({
          variables: { id: postId, postInput }
        })
      ).data?.updatePost;
    }

    return (
      await createPost({
        variables: { postInput },
        refetchQueries: [GetPostsDocument],
        awaitRefetchQueries: true
      })
    ).data?.createPost;
  };

  const removePost = (postId: string) =>
    deletePost({
      variables: { id: postId },
      update: (cache) => {
        const cacheId = cache.identify({ __typename: 'Post', _id: postId });
        if (cacheId) {
          cache.evict({ id: cacheId });
          cache.gc();
        }
      },
      refetchQueries: [GetPostsDocument],
      awaitRefetchQueries: true
    });

  return {
    savePost,
    removePost,
    saving: createState.loading || updateState.loading,
    deleting: deleteState.loading
  };
};
