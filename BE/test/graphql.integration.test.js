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
const resolvers = require('../graphql/resolvers/index');
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
  assert.equal(signupResult.body.singleResult.data.createUser.name, 'Post Owner');
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
          content
          imageUrl
          creator { _id name }
        }
      }
    `,
    {
      postInput: {
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
    `query Post($id: ID!) { post(id: $id) { _id content } }`,
    { id: createdPost._id },
    req
  );
  assert.equal(
    readResult.body.singleResult.data.post.content,
    'Created through the GraphQL schema.'
  );

  const updateResult = await execute(
    `
      mutation UpdatePost($id: ID!, $postInput: PostInputData!) {
        updatePost(id: $id, postInput: $postInput) { _id content imageUrl }
      }
    `,
    {
      id: createdPost._id,
      postInput: {
        content: 'Updated through the GraphQL schema.',
        imageUploadId: null
      }
    },
    req
  );

  assert.equal(
    updateResult.body.singleResult.data.updatePost.content,
    'Updated through the GraphQL schema.'
  );
  assert.equal(updateResult.body.singleResult.data.updatePost.imageUrl, createdPost.imageUrl);

  const deleteResult = await execute(
    `mutation DeletePost($id: ID!) { deletePost(id: $id) }`,
    { id: createdPost._id },
    req
  );

  assert.equal(deleteResult.body.singleResult.data.deletePost, true);
  assert.equal(await Post.countDocuments(), 0);
  await assert.rejects(fs.access(path.join(imagesDirectory, path.basename(createdPost.imageUrl))));
});

test('text-only posts are valid and short-post limits are enforced', async () => {
  await createUser('text-only@example.com', 'Text Only');
  const loginResult = await login('text-only@example.com');
  const req = authenticatedRequest(loginResult.body.singleResult.data.login.userId);
  const mutation = `
    mutation CreatePost($postInput: PostInputData!) {
      createPost(postInput: $postInput) { _id content imageUrl }
    }
  `;

  const createResult = await execute(
    mutation,
    { postInput: { content: 'A concise post without an image.', imageUploadId: null } },
    req
  );
  assert.equal(createResult.body.singleResult.errors, undefined);
  assert.equal(createResult.body.singleResult.data.createPost.imageUrl, null);

  const invalidResult = await execute(
    mutation,
    { postInput: { content: 'x'.repeat(501), imageUploadId: null } },
    req
  );
  assert.equal(invalidResult.body.singleResult.errors[0].message, 'Validation failed.');
  assert.equal(await Post.countDocuments(), 1);
});

test('authenticated profiles expose public fields and can filter posts by creator', async () => {
  await createUser('profile@example.com', 'Profile User');
  const loginResult = await login('profile@example.com');
  const userId = loginResult.body.singleResult.data.login.userId;
  await Post.create({ content: 'Profile timeline post.', creator: userId });

  const result = await execute(
    `
      query Profile($id: ID!) {
        user(id: $id) { _id name status }
        posts(first: 2, creatorId: $id) { posts { content creator { _id } } }
      }
    `,
    { id: userId },
    authenticatedRequest(userId)
  );

  assert.equal(result.body.singleResult.errors, undefined);
  assert.equal(result.body.singleResult.data.user.name, 'Profile User');
  assert.equal(result.body.singleResult.data.posts.posts[0].creator._id, userId);

  const privateFieldResult = await execute(
    `query PrivateField { posts(first: 1) { posts { creator { email } } } }`,
    {},
    authenticatedRequest(userId)
  );
  assert.match(
    privateFieldResult.body.singleResult.errors[0].message,
    /Cannot query field "email"/
  );
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
  assert.equal((await Post.findById(postId)).content, 'Only its creator may change this post.');
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
  const tiedCreatedAt = new Date('2026-08-09T12:00:00.000Z');
  await Post.insertMany([
    {
      _id: '507f1f77bcf86cd799439011',
      content: 'First cursor post.',
      creator: firstUser._id,
      createdAt: tiedCreatedAt,
      updatedAt: tiedCreatedAt
    },
    {
      _id: '507f1f77bcf86cd799439012',
      content: 'Second cursor post.',
      creator: secondUser._id,
      createdAt: tiedCreatedAt,
      updatedAt: tiedCreatedAt
    },
    {
      _id: '507f1f77bcf86cd799439013',
      content: 'Third cursor post.',
      creator: firstUser._id,
      createdAt: tiedCreatedAt,
      updatedAt: tiedCreatedAt
    }
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
            posts { _id content creator { _id name } }
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
    assert.deepEqual(
      firstPageData.posts.map((post) => post._id),
      ['507f1f77bcf86cd799439013', '507f1f77bcf86cd799439012']
    );
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
    assert.equal(secondPageData.posts[0]._id, '507f1f77bcf86cd799439011');
    assert.equal(secondPageData.pageInfo.hasNextPage, false);
    assert.equal(
      firstPageData.posts.some((post) => post._id === secondPageData.posts[0]._id),
      false
    );
  } finally {
    dependencies.repositories.user.findByIds = originalFindByIds;
  }
});

test('creator pagination tolerates a deleted cursor post and a newer concurrent insert', async () => {
  const creator = await User.create({
    email: 'creator-cursor@example.com',
    name: 'Creator Cursor User',
    password: 'not-used-in-this-test'
  });
  const otherUser = await User.create({
    email: 'other-cursor@example.com',
    name: 'Other Cursor User',
    password: 'not-used-in-this-test'
  });
  const creatorPostIds = [
    '507f1f77bcf86cd799439021',
    '507f1f77bcf86cd799439022',
    '507f1f77bcf86cd799439023',
    '507f1f77bcf86cd799439024'
  ];
  await Post.insertMany([
    ...creatorPostIds.map((id, index) => ({
      _id: id,
      content: `Creator post ${index + 1}`,
      creator: creator._id,
      createdAt: new Date(`2026-08-0${index + 1}T12:00:00.000Z`),
      updatedAt: new Date(`2026-08-0${index + 1}T12:00:00.000Z`)
    })),
    {
      _id: '507f1f77bcf86cd799439025',
      content: 'Another creator must stay filtered out.',
      creator: otherUser._id,
      createdAt: new Date('2026-08-03T18:00:00.000Z'),
      updatedAt: new Date('2026-08-03T18:00:00.000Z')
    }
  ]);

  const query = `
    query CreatorPosts($creatorId: ID!, $after: String) {
      posts(first: 2, creatorId: $creatorId, after: $after) {
        posts { _id }
        pageInfo { endCursor hasNextPage }
      }
    }
  `;
  const request = authenticatedRequest(creator._id.toString());
  const firstResult = await execute(query, { creatorId: creator._id.toString() }, request);
  const firstPage = firstResult.body.singleResult.data.posts;

  assert.deepEqual(
    firstPage.posts.map((post) => post._id),
    [creatorPostIds[3], creatorPostIds[2]]
  );
  assert.equal(firstPage.pageInfo.hasNextPage, true);

  await Post.findByIdAndDelete(creatorPostIds[2]);
  await Post.create({
    _id: '507f1f77bcf86cd799439026',
    content: 'Inserted after the first page was read.',
    creator: creator._id,
    createdAt: new Date('2026-08-06T12:00:00.000Z'),
    updatedAt: new Date('2026-08-06T12:00:00.000Z')
  });

  const secondResult = await execute(
    query,
    {
      creatorId: creator._id.toString(),
      after: firstPage.pageInfo.endCursor
    },
    request
  );
  const secondPage = secondResult.body.singleResult.data.posts;

  assert.deepEqual(
    secondPage.posts.map((post) => post._id),
    [creatorPostIds[1], creatorPostIds[0]]
  );
  assert.equal(secondPage.pageInfo.hasNextPage, false);
});

test('cursor pagination rejects malformed cursors cleanly', async () => {
  const user = await User.create({
    email: 'cursor-error@example.com',
    name: 'Cursor Error User',
    password: 'not-used-in-this-test'
  });
  const result = await execute(
    `query InvalidCursor($after: String) { posts(first: 2, after: $after) { posts { _id } } }`,
    { after: 'not+a+cursor' },
    authenticatedRequest(user._id.toString())
  );

  assert.equal(result.body.singleResult.errors[0].message, 'Invalid cursor.');
});

test('feed sort uses the compound timeline index according to explain', async () => {
  await Post.collection.createIndex({ createdAt: -1, _id: -1 });
  const user = await User.create({
    email: 'explain@example.com',
    name: 'Explain User',
    password: 'not-used-in-this-test'
  });
  await Post.create({
    content: 'Used to inspect the feed query plan.',
    creator: user._id
  });

  const plan = await Post.find().sort({ createdAt: -1, _id: -1 }).explain('executionStats');
  const serializedPlan = JSON.stringify(plan);

  assert.match(serializedPlan, /IXSCAN/);
  assert.match(serializedPlan, /createdAt_-1__id_-1/);
});
