const { buildSchema } = require('graphql');

module.exports = buildSchema(`
  type User {
    _id: ID!
    email: String!
    name: String!
    status: String!
    posts: [Post!]!
    createdAt: String!
    updatedAt: String!
  }

  type Post {
    _id: ID!
    title: String!
    content: String!
    imageUrl: String!
    creator: User!
    createdAt: String!
    updatedAt: String!
  }

  type AuthData {
    token: String!
    userId: String!
    expiresIn: Int!
  }

  type StatusData {
    status: String!
  }

  type PostsData {
    posts: [Post!]!
    totalItems: Int!
  }

  input UserInputData {
    email: String!
    name: String!
    password: String!
  }

  input PostInputData {
    title: String!
    content: String!
    image: String
    oldImagePath: String
  }

  type RootQuery {
    posts(page: Int, limit: Int): PostsData!
    post(id: ID!): Post!
    status: StatusData!
  }

  type RootMutation {
    createUser(userInput: UserInputData!): User!
    login(email: String!, password: String!): AuthData!
    createPost(postInput: PostInputData!): Post!
    updatePost(id: ID!, postInput: PostInputData!): Post!
    deletePost(id: ID!): Boolean!
    updateStatus(status: String!): StatusData!
  }

  schema {
    query: RootQuery
    mutation: RootMutation
  }
`);
