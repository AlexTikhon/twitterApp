// Frontend endpoints are kept in one place so switching environments is easy.
export const API_URL =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? 'http://localhost:8080' : '');

export const GRAPHQL_URL = `${API_URL}/graphql`;
