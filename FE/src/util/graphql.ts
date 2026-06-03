// Sends GraphQL requests and normalizes backend errors into thrown JS errors.
import { ApolloClient, HttpLink, InMemoryCache, gql } from '@apollo/client';

import { GRAPHQL_URL } from '../config';

type GraphqlRequestOptions = {
  query: string;
  variables?: Record<string, unknown>;
  token?: string | null;
};

// Creates an Apollo client for one request with optional bearer auth headers.
const createClient = (token?: string | null) => {
  const headers: Record<string, string> = {};
  if (token) {
    headers.Authorization = 'Bearer ' + token;
  }

  return new ApolloClient({
    link: new HttpLink({
      uri: GRAPHQL_URL,
      headers
    }),
    cache: new InMemoryCache(),
    defaultOptions: {
      query: {
        fetchPolicy: 'no-cache'
      },
      mutate: {
        fetchPolicy: 'no-cache'
      }
    }
  });
};

// Executes a GraphQL query or mutation and rethrows errors in the app format.
export const graphqlRequest = async <TData = any>({
  query,
  variables = {},
  token
}: GraphqlRequestOptions): Promise<TData> => {
  const client = createClient(token);
  const document = gql(query);
  const isMutation = query.trim().startsWith('mutation');

  try {
    const result = isMutation
      ? await client.mutate<TData>({
          mutation: document,
          variables
        })
      : await client.query<TData>({
          query: document,
          variables
        });

    return result.data as TData;
  } catch (apolloError: any) {
    const graphqlError = apolloError.graphQLErrors?.[0];
    const error = new Error(
      graphqlError?.message || apolloError.message || 'GraphQL request failed.'
    ) as Error & { data?: unknown; statusCode?: number };

    error.data = graphqlError?.data || null;
    error.statusCode =
      graphqlError?.status ||
      apolloError.networkError?.statusCode ||
      apolloError.networkError?.status ||
      500;

    throw error;
  }
};
