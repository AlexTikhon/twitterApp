const mongoose = require('mongoose');

const { loadConfig } = require('../config');
const User = require('../models/user');

const migrate = async () => {
  const config = loadConfig();
  await mongoose.connect(config.mongodbUri);

  try {
    const result = await User.collection.updateMany(
      { posts: { $exists: true } },
      { $unset: { posts: '' } }
    );

    console.log(
      `User.posts migration completed: matched ${result.matchedCount}, modified ${result.modifiedCount}.`
    );
  } finally {
    await mongoose.disconnect();
  }
};

migrate().catch((error) => {
  console.error('User.posts migration failed:', error.message);
  process.exitCode = 1;
});
