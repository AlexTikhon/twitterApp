const assert = require('node:assert/strict');
const http = require('node:http');
const { after, afterEach, before, beforeEach, test } = require('node:test');

const { ApolloServer } = require('@apollo/server');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const resolvers = require('../graphql/resolvers');
const typeDefs = require('../graphql/schema');
const Post = require('../models/post');
const User = require('../models/user');
const realtime = require('../socket');
const clearImage = require('../util/file');

const TEST_JWT_SECRET = 'graphql-integration-test-secret-with-sufficient-length';
const VALID_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

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
let previousJwtSecret;

const execute = (query, variables = {}, req = { isAuth: false }) =>
  graphqlServer.executeOperation(
    { query, variables },
    {
      contextValue: { req }
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

before(async () => {
  previousJwtSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = TEST_JWT_SECRET;

  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());

  graphqlServer = new ApolloServer({ typeDefs, resolvers });
  await graphqlServer.start();

  socketServer = http.createServer();
  io = realtime.init(socketServer, ['http://localhost']);
});

beforeEach(async () => {
  await mongoose.connection.db.dropDatabase();
});

afterEach(async () => {
  const storedPosts = await Post.find().select('imageUrl');
  await Promise.all(storedPosts.map((post) => clearImage(post.imageUrl)));
});

after(async () => {
  await io.close();
  await graphqlServer.stop();
  await mongoose.disconnect();
  await mongoServer.stop();

  if (previousJwtSecret === undefined) {
    delete process.env.JWT_SECRET;
  } else {
    process.env.JWT_SECRET = previousJwtSecret;
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
        image: VALID_PNG
      }
    },
    req
  );
  const createdPost = createResult.body.singleResult.data.createPost;

  assert.equal(createdPost.creator._id, userId);
  assert.match(createdPost.imageUrl, /^\/images\//);

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
        image: ''
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
        image: VALID_PNG
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
        image: ''
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
