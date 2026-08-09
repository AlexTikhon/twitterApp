const authResolvers = require('./auth');
const postResolvers = require('./posts');
const profileResolvers = require('./profile');

const mergeRoot = (rootName) => ({
  ...authResolvers[rootName],
  ...postResolvers[rootName],
  ...profileResolvers[rootName]
});

const toIsoDate = (value) => new Date(value).toISOString();

module.exports = {
  RootQuery: mergeRoot('RootQuery'),
  RootMutation: mergeRoot('RootMutation'),
  Post: {
    _id: (post) => post._id.toString(),
    createdAt: (post) => toIsoDate(post.createdAt),
    updatedAt: (post) => toIsoDate(post.updatedAt),
    creator: async (post, _args, { loaders }) => {
      if (post.creator?.name) {
        return post.creator;
      }

      const creatorId = post.creator?._id || post.creator;
      const creator = await loaders.userById.load(creatorId.toString());
      if (!creator) {
        const error = new Error('User not found.');
        error.statusCode = 404;
        throw error;
      }
      return creator;
    }
  },
  User: {
    _id: (user) => user._id.toString(),
    createdAt: (user) => toIsoDate(user.createdAt),
    updatedAt: (user) => toIsoDate(user.updatedAt)
  }
};
