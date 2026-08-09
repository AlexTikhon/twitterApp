const { requireAuthenticatedUser } = require('./shared');

module.exports = {
  RootQuery: {
    posts: (_parent, args, context) => {
      requireAuthenticatedUser(context.req);
      return context.services.posts.list(args);
    },
    post: (_parent, { id }, context) => {
      requireAuthenticatedUser(context.req);
      return context.services.posts.get(id);
    }
  },
  RootMutation: {
    createPost: (_parent, { postInput }, context) =>
      context.services.posts.create(requireAuthenticatedUser(context.req), postInput),
    updatePost: (_parent, { id, postInput }, context) =>
      context.services.posts.update(requireAuthenticatedUser(context.req), id, postInput),
    deletePost: (_parent, { id }, context) =>
      context.services.posts.delete(requireAuthenticatedUser(context.req), id)
  }
};
