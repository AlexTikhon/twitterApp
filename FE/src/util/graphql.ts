// Sends typed GraphQL documents through the application-wide Apollo client.
import type { TypedDocumentNode } from '@apollo/client';

import { apolloClient } from '../apollo';

type GraphqlRequestOptions = {
  document: TypedDocumentNode<unknown, unknown>;
  variables?: unknown;
};

export type GraphqlRequestError = Error & {
  data?: unknown;
  statusCode?: number;
};

export const isUnauthorizedError = (error: unknown) =>
  Boolean(error && typeof error === 'object' && (error as GraphqlRequestError).statusCode === 401);

// Executes a GraphQL query or mutation and rethrows errors in the app format.
export const graphqlRequest = async <TData, TVariables>({
  document,
  variables
}: GraphqlRequestOptions & {
  document: TypedDocumentNode<TData, TVariables>;
  variables?: TVariables;
}): Promise<TData> => {
  const operation = document.definitions.find(
    (definition) => definition.kind === 'OperationDefinition'
  );
  const isMutation =
    operation?.kind === 'OperationDefinition' && operation.operation === 'mutation';

  try {
    const result = isMutation
      ? await apolloClient.mutate<TData, TVariables>({
          mutation: document,
          variables: variables as TVariables
        })
      : await apolloClient.query<TData, TVariables>({
          query: document,
          variables: variables as TVariables
        });

    return result.data as TData;
  } catch (rawError: unknown) {
    const apolloError = rawError as {
      graphQLErrors?: Array<{
        message?: string;
        data?: unknown;
        status?: number;
      }>;
      message?: string;
      networkError?: {
        statusCode?: number;
        status?: number;
      };
    };
    const graphqlError = apolloError.graphQLErrors?.[0];
    const error = new Error(
      graphqlError?.message || apolloError.message || 'GraphQL request failed.'
    ) as GraphqlRequestError;

    error.data = graphqlError?.data || null;
    error.statusCode =
      graphqlError?.status ||
      apolloError.networkError?.statusCode ||
      apolloError.networkError?.status ||
      500;

    throw error;
  }
};
