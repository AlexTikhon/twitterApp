const DataLoader = require('dataloader');

const createLoaders = ({ user: userRepository }) => ({
  userById: new DataLoader(async (ids) => {
    const users = await userRepository.findByIds(ids);
    const usersById = new Map(users.map((user) => [user._id.toString(), user]));
    return ids.map((id) => usersById.get(id.toString()) || null);
  })
});

module.exports = { createLoaders };
