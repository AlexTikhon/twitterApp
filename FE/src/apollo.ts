import { ApolloClient, HttpLink, InMemoryCache, from } from '@apollo/client';
import { onError } from '@apollo/client/link/error';
import { setContext } from '@apollo/client/link/context';

import { GRAPHQL_URL } from './config';
import { clearSession, getSession } from './session';

const authLink = setContext((_, { headers }) => {
  const token = getSession()?.token;

  return {
    headers: {
      ...headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
  };
});

const errorLink = onError(({ graphQLErrors, networkError }) => {
  const hasUnauthorizedGraphqlError = graphQLErrors?.some((error) => {
    const extensions = error.extensions as { status?: number } | undefined;
    return (
      extensions?.status === 401 || (error as typeof error & { status?: number }).status === 401
    );
  });
  const networkStatus = (networkError as { statusCode?: number; status?: number } | undefined)
    ?.statusCode;
  const fallbackNetworkStatus = (networkError as { status?: number } | undefined)?.status;

  if (hasUnauthorizedGraphqlError || networkStatus === 401 || fallbackNetworkStatus === 401) {
    clearSession();
  }
});

export const apolloClient = new ApolloClient({
  link: from([errorLink, authLink, new HttpLink({ uri: GRAPHQL_URL })]),
  cache: new InMemoryCache({
    typePolicies: {
      RootQuery: { queryType: true },
      RootMutation: { mutationType: true },
      Post: { keyFields: ['_id'] },
      User: { keyFields: ['_id'] }
    }
  })
});
