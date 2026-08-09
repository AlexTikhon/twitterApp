const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { after, afterEach, before, beforeEach, test } = require('node:test');

const { ApolloServer } = require('@apollo/server');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');

const { loadConfig } = require('../config');
const { createDependencies } = require('../dependencies');
const { createLoaders } = require('../graphql/loaders');
const resolvers = require('../graphql/resolvers');
const typeDefs = require('../graphql/schema');
const { createValidationRules } = require('../graphql/validation');
const Post = require('../models/post');
const User = require('../models/user');
const realtime = require('../socket');

const TEST_JWT_SECRET = 'graphql-integration-test-secret-with-sufficient-length';
const VALID_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64'
);

const CREATE_USER = `
  mutation CreateUser($email: String!, $name: String!, $password: String!) {
    createUser(userInput: { email: $email, name: $name, password: $password }) {
      _id
      email
      name
    }
  }
`;

const LOGIN = `
  mutation Login($email: String!, $password: String!) {
    login(email: $email, password: $password) {
      token
      userId
      expiresIn
    }
  }
`;

let mongoServer;
let graphqlServer;
let socketServer;
let io;
let dependencies;
let imagesDirectory;

const execute = (query, variables = {}, req = { isAuth: false }) =>
  graphqlServer.executeOperation(
    { query, variables },
    {
      contextValue: {
        req,
        services: dependencies.services,
        loaders: createLoaders(dependencies.repositories)
      }
    }
  );

const createUser = (email, name = 'Integration User') =>
  execute(CREATE_USER, {
    email,
    name,
    password: 'secure-password'
  });

const login = (email) =>
  execute(LOGIN, {
    email,
    password: 'secure-password'
  });

const authenticatedRequest = (userId) => ({
  isAuth: true,
  userId
});

const uploadImage = (userId) =>
  dependencies.services.imageUploads.upload(userId, {
    buffer: VALID_PNG,
    mimetype: 'image/png'
  });

before(async () => {
  mongoServer = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: 'wiredTiger' }
  });
  await mongoose.connect(mongoServer.getUri());
  imagesDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'twitter-graphql-test-'));
  const baseConfig = loadConfig({
    MONGODB_URI: mongoServer.getUri(),
    JWT_SECRET: TEST_JWT_SECRET,
    NODE_ENV: 'test'
  });
  const config = {
    ...baseConfig,
    storage: { ...baseConfig.storage, imagesDirectory }
  };
  dependencies = createDependencies(config);

  graphqlServer = new ApolloServer({
    typeDefs,
    resolvers,
    validationRules: createValidationRules(config.graphql)
  });
  await graphqlServer.start();

  socketServer = http.createServer();
  io = realtime.init(socketServer, {
    allowedOrigins: ['http://localhost'],
    jwtSecret: TEST_JWT_SECRET
  });
});

beforeEach(async () => {
  await mongoose.connection.db.dropDatabase();
});

afterEach(async () => {
  if (!dependencies || mongoose.connection.readyState === 0) {
    return;
  }

  const storedPosts = await Post.find().select('imageUrl');
  await Promise.all(
    storedPosts
      .filter((post) => post.imageUrl)
      .map((post) => dependencies.imageStorage.delete(post.imageUrl))
  );
});

after(async () => {
  if (io) {
    await io.close();
  }
  if (graphqlServer) {
    await graphqlServer.stop();
  }
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (mongoServer) {
    await mongoServer.stop();
  }
  if (imagesDirectory) {
    await fs.rm(imagesDirectory, { force: true, recursive: true });
  }
});

test('signup and login persist a user and return a verifiable JWT', async () => {
  const signupResult = await createUser('owner@example.com', 'Post Owner');

  assert.equal(signupResult.body.kind, 'single');
  assert.equal(signupResult.body.singleResult.errors, undefined);
  assert.equal(signupResult.body.singleResult.data.createUser.email, 'owner@example.com');
  assert.equal(await User.countDocuments(), 1);

  const loginResult = await login('owner@example.com');
  const authData = loginResult.body.singleResult.data.login;
  const payload = jwt.verify(authData.token, TEST_JWT_SECRET);

  assert.equal(payload.userId, authData.userId);
  assert.equal(authData.expiresIn, 3600);
});

test('authenticated user can create, read, update, and delete a post', async () => {
  await createUser('owner@example.com', 'Post Owner');
  const loginResult = await login('owner@example.com');
  const { userId } = loginResult.body.singleResult.data.login;
  const req = authenticatedRequest(userId);
  const { uploadId } = await uploadImage(userId);

  const createResult = await execute(
    `
      mutation CreatePost($postInput: PostInputData!) {
        createPost(postInput: $postInput) {
          _id
          title
          content
          imageUrl
          creator { _id name }
        }
      }
    `,
    {
      postInput: {
        title: 'Integration post',
        content: 'Created through the GraphQL schema.',
        imageUploadId: uploadId
      }
    },
    req
  );
  assert.equal(
    createResult.body.singleResult.errors,
    undefined,
    JSON.stringify(createResult.body.singleResult.errors)
  );
  const createdPost = createResult.body.singleResult.data.createPost;

  assert.equal(createdPost.creator._id, userId);
  assert.match(createdPost.imageUrl, /^\/images\//);

  const reusedUploadResult = await execute(
    `
      mutation ReuseImageUpload($postInput: PostInputData!) {
        createPost(postInput: $postInput) { _id }
      }
    `,
    {
      postInput: {
        title: 'Reused image upload',
        content: 'This mutation must not create another post.',
        imageUploadId: uploadId
      }
    },
    req
  );
  assert.equal(
    reusedUploadResult.body.singleResult.errors[0].message,
    'Image upload is invalid, expired, or already used.'
  );

  const readResult = await execute(
    `query Post($id: ID!) { post(id: $id) { _id title content } }`,
    { id: createdPost._id },
    req
  );
  assert.equal(readResult.body.singleResult.data.post.title, 'Integration post');

  const updateResult = await execute(
    `
      mutation UpdatePost($id: ID!, $postInput: PostInputData!) {
        updatePost(id: $id, postInput: $postInput) { _id title content imageUrl }
      }
    `,
    {
      id: createdPost._id,
      postInput: {
        title: 'Updated integration post',
        content: 'Updated through the GraphQL schema.',
        imageUploadId: null
      }
    },
    req
  );

  assert.equal(updateResult.body.singleResult.data.updatePost.title, 'Updated integration post');
  assert.equal(updateResult.body.singleResult.data.updatePost.imageUrl, createdPost.imageUrl);

  const deleteResult = await execute(
    `mutation DeletePost($id: ID!) { deletePost(id: $id) }`,
    { id: createdPost._id },
    req
  );

  assert.equal(deleteResult.body.singleResult.data.deletePost, true);
  assert.equal(await Post.countDocuments(), 0);
});

test('anonymous and non-owner requests cannot mutate a post', async () => {
  await createUser('owner@example.com', 'Post Owner');
  await createUser('other@example.com', 'Other User');

  const ownerLogin = await login('owner@example.com');
  const otherLogin = await login('other@example.com');
  const ownerId = ownerLogin.body.singleResult.data.login.userId;
  const otherId = otherLogin.body.singleResult.data.login.userId;
  const { uploadId } = await uploadImage(ownerId);

  const createResult = await execute(
    `
      mutation CreatePost($postInput: PostInputData!) {
        createPost(postInput: $postInput) { _id }
      }
    `,
    {
      postInput: {
        title: 'Owner only post',
        content: 'Only its creator may change this post.',
        imageUploadId: uploadId
      }
    },
    authenticatedRequest(ownerId)
  );
  const postId = createResult.body.singleResult.data.createPost._id;

  const anonymousResult = await execute(`mutation DeletePost($id: ID!) { deletePost(id: $id) }`, {
    id: postId
  });
  assert.equal(anonymousResult.body.singleResult.errors[0].message, 'Not authenticated.');

  const forbiddenResult = await execute(
    `
      mutation UpdatePost($id: ID!, $postInput: PostInputData!) {
        updatePost(id: $id, postInput: $postInput) { _id }
      }
    `,
    {
      id: postId,
      postInput: {
        title: 'Changed by another user',
        content: 'This update must be rejected.',
        imageUploadId: null
      }
    },
    authenticatedRequest(otherId)
  );

  assert.equal(
    forbiddenResult.body.singleResult.errors[0].message,
    'Not authorized to update this post.'
  );
  assert.equal((await Post.findById(postId)).title, 'Owner only post');
});

test('cursor pagination is stable and creator loading is batched', async () => {
  const firstUser = await User.create({
    email: 'first@example.com',
    name: 'First User',
    password: 'not-used-in-this-test'
  });
  const secondUser = await User.create({
    email: 'second@example.com',
    name: 'Second User',
    password: 'not-used-in-this-test'
  });
  await Post.insertMany([
    { title: 'Cursor post one', content: 'First cursor post.', creator: firstUser._id },
    { title: 'Cursor post two', content: 'Second cursor post.', creator: secondUser._id },
    { title: 'Cursor post three', content: 'Third cursor post.', creator: firstUser._id }
  ]);

  let batchCalls = 0;
  const originalFindByIds = dependencies.repositories.user.findByIds.bind(
    dependencies.repositories.user
  );
  dependencies.repositories.user.findByIds = (...args) => {
    batchCalls += 1;
    return originalFindByIds(...args);
  };

  try {
    const firstPage = await execute(
      `
        query CursorPosts($first: Int!, $after: String) {
          posts(first: $first, after: $after) {
            posts { _id title creator { _id name } }
            pageInfo { endCursor hasNextPage }
            totalItems
          }
        }
      `,
      { first: 2, after: null },
      authenticatedRequest(firstUser._id.toString())
    );
    const firstPageData = firstPage.body.singleResult.data.posts;

    assert.equal(firstPageData.posts.length, 2);
    assert.equal(firstPageData.pageInfo.hasNextPage, true);
    assert.equal(firstPageData.totalItems, 3);
    assert.equal(batchCalls, 1);

    const secondPage = await execute(
      `
        query CursorPosts($first: Int!, $after: String) {
          posts(first: $first, after: $after) {
            posts { _id }
            pageInfo { endCursor hasNextPage }
          }
        }
      `,
      { first: 2, after: firstPageData.pageInfo.endCursor },
      authenticatedRequest(firstUser._id.toString())
    );
    const secondPageData = secondPage.body.singleResult.data.posts;

    assert.equal(secondPageData.posts.length, 1);
    assert.equal(secondPageData.pageInfo.hasNextPage, false);
    assert.notEqual(secondPageData.posts[0]._id, firstPageData.posts[0]._id);
  } finally {
    dependencies.repositories.user.findByIds = originalFindByIds;
  }
});

test('feed sort uses the declared createdAt index according to explain', async () => {
  await Post.collection.createIndex({ createdAt: -1 });
  const user = await User.create({
    email: 'explain@example.com',
    name: 'Explain User',
    password: 'not-used-in-this-test'
  });
  await Post.create({
    title: 'Indexed feed post',
    content: 'Used to inspect the feed query plan.',
    creator: user._id
  });

  const plan = await Post.find().sort({ createdAt: -1 }).explain('executionStats');
  const serializedPlan = JSON.stringify(plan);

  assert.match(serializedPlan, /IXSCAN/);
  assert.match(serializedPlan, /createdAt_-1/);
});
