// Sends GraphQL requests and normalizes backend errors into thrown JS errors.
import { GRAPHQL_URL } from '../config';

export const graphqlRequest = async ({ query, variables = {}, token }) => {
  const headers = {
    'Content-Type': 'application/json'
  };

  if (token) {
    headers.Authorization = 'Bearer ' + token;
  }

  const res = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      query,
      variables
    })
  });

  const resData = await res.json();

  if (resData.errors && resData.errors.length > 0) {
    const graphqlError = resData.errors[0];
    const error = new Error(graphqlError.message || 'GraphQL request failed.');

    error.data = graphqlError.data || null;
    error.statusCode = graphqlError.status || res.status;

    throw error;
  }

  if (res.status !== 200 && res.status !== 201) {
    const error = new Error('GraphQL request failed.');
    error.statusCode = res.status;
    throw error;
  }

  return resData.data;
};
