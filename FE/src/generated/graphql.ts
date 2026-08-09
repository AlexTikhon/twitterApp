/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> =
  T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
export type PostInputData = {
  readonly content: string;
  readonly imageUploadId: string | number | null | undefined;
  readonly title: string;
};

export type CreateUserMutationVariables = Exact<{
  email: string;
  name: string;
  password: string;
}>;

export type CreateUserMutation = { readonly createUser: { readonly _id: string } };

export type LoginMutationVariables = Exact<{
  email: string;
  password: string;
}>;

export type LoginMutation = {
  readonly login: { readonly token: string; readonly userId: string; readonly expiresIn: number };
};

export type GetStatusQueryVariables = Exact<{ [key: string]: never }>;

export type GetStatusQuery = { readonly status: { readonly status: string } };

export type UpdateStatusMutationVariables = Exact<{
  status: string;
}>;

export type UpdateStatusMutation = { readonly updateStatus: { readonly status: string } };

export type GetPostsQueryVariables = Exact<{
  page: number | null | undefined;
  limit: number | null | undefined;
  first: number | null | undefined;
  after: string | null | undefined;
}>;

export type GetPostsQuery = {
  readonly posts: {
    readonly totalItems: number;
    readonly pageInfo: { readonly endCursor: string | null; readonly hasNextPage: boolean };
    readonly posts: ReadonlyArray<{
      readonly _id: string;
      readonly title: string;
      readonly content: string;
      readonly imageUrl: string;
      readonly createdAt: string;
      readonly creator: { readonly _id: string; readonly name: string };
    }>;
  };
};

export type GetPostQueryVariables = Exact<{
  id: string | number;
}>;

export type GetPostQuery = {
  readonly post: {
    readonly _id: string;
    readonly title: string;
    readonly content: string;
    readonly imageUrl: string;
    readonly createdAt: string;
    readonly creator: { readonly _id: string; readonly name: string };
  };
};

export type CreatePostMutationVariables = Exact<{
  postInput: PostInputData;
}>;

export type CreatePostMutation = {
  readonly createPost: {
    readonly _id: string;
    readonly title: string;
    readonly content: string;
    readonly imageUrl: string;
    readonly createdAt: string;
    readonly creator: { readonly _id: string; readonly name: string };
  };
};

export type UpdatePostMutationVariables = Exact<{
  id: string | number;
  postInput: PostInputData;
}>;

export type UpdatePostMutation = {
  readonly updatePost: {
    readonly _id: string;
    readonly title: string;
    readonly content: string;
    readonly imageUrl: string;
    readonly createdAt: string;
    readonly creator: { readonly _id: string; readonly name: string };
  };
};

export type DeletePostMutationVariables = Exact<{
  id: string | number;
}>;

export type DeletePostMutation = { readonly deletePost: boolean };
