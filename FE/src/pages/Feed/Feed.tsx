// Owns the timeline UI, GraphQL feed operations, and realtime socket updates.
import React, { Component, Fragment } from 'react';
import openSocket from 'socket.io-client';

import Post from '../../components/Feed/Post/Post';
import Button from '../../components/Button/Button';
import FeedEdit from '../../components/Feed/FeedEdit/FeedEdit';
import Input from '../../components/Form/Input/Input';
import Paginator from '../../components/Paginator/Paginator';
import Loader from '../../components/Loader/Loader';
import ErrorHandler from '../../components/ErrorHandler/ErrorHandler';
import { API_URL } from '../../config';
import { graphqlRequest } from '../../util/graphql';
import './Feed.css';

class Feed extends Component<any, any> {
  socket: any = null;

  state: any = {
    isEditing: false,
    posts: [],
    totalPosts: 0,
    editPost: null,
    status: '',
    postPage: 1,
    postsLoading: true,
    editLoading: false,
    error: null
  };

  componentDidMount() {
    this.socket = openSocket(API_URL);
    // Socket events keep the visible page in sync after create, update, and delete actions.
    this.socket.on('posts', data => {
      if (data.action === 'create') {
        this.addPost(data.post);
      }
      if (data.action === 'update') {
        this.updatePost(data.post);
      }
      if (data.action === 'delete') {
        this.removePost(data.post._id);
      }
    });

    this.loadInitialData();
  }

  componentWillUnmount() {
    if (this.socket) {
      this.socket.disconnect();
    }
  }

  loadInitialData = async () => {
    try {
      const data = await graphqlRequest({
        query: `
          query GetStatus {
            status {
              status
            }
          }
        `,
        token: this.props.token
      });

      this.setState({ status: data.status.status });
      // The status query and first posts query are separated to keep the UI responsive.
      await this.loadPosts();
    } catch (error) {
      this.catchError(error);
    }
  };

  loadPosts = async (direction?: string) => {
    try {
      if (direction) {
        this.setState({ postsLoading: true, posts: [] });
      }
      let page = this.state.postPage;
      // Pagination is driven locally and then mirrored in the GraphQL query variables.
      if (direction === 'next') {
        page++;
        this.setState({ postPage: page });
      }
      if (direction === 'previous') {
        page--;
        this.setState({ postPage: page });
      }

      const data = await graphqlRequest({
        query: `
          query GetPosts($page: Int!, $limit: Int!) {
            posts(page: $page, limit: $limit) {
              totalItems
              posts {
                _id
                title
                content
                imageUrl
                createdAt
                creator {
                  _id
                  name
                }
              }
            }
          }
        `,
        variables: {
          page,
          limit: 2
        },
        token: this.props.token
      });

      this.setState({
        posts: data.posts.posts,
        totalPosts: data.posts.totalItems,
        postsLoading: false
      });
    } catch (error) {
      this.catchError(error);
    }
  };

  statusUpdateHandler = async event => {
    event.preventDefault();
    try {
      const data = await graphqlRequest({
        query: `
          mutation UpdateStatus($status: String!) {
            updateStatus(status: $status) {
              status
            }
          }
        `,
        variables: {
          status: this.state.status
        },
        token: this.props.token
      });

      this.setState({ status: data.updateStatus.status });
    } catch (error) {
      this.catchError(error);
    }
  };

  newPostHandler = () => {
    this.setState({ isEditing: true });
  };

  addPost = post => {
    this.setState(prevState => {
      const postAlreadyExists = prevState.posts.some(
        existingPost => existingPost._id === post._id
      );

      if (postAlreadyExists) {
        return null;
      }

      const totalPosts = prevState.totalPosts + 1;

      // Only the first page inserts the new item immediately into the visible list.
      if (prevState.postPage !== 1) {
        return { totalPosts };
      }

      return {
        posts: [post, ...prevState.posts].slice(0, 2),
        totalPosts
      };
    });
  };

  updatePost = post => {
    this.setState(prevState => {
      const postIndex = prevState.posts.findIndex(
        existingPost => existingPost._id === post._id
      );

      if (postIndex < 0) {
        return null;
      }

      const updatedPosts = [...prevState.posts];
      updatedPosts[postIndex] = post;

      return {
        posts: updatedPosts
      };
    });
  };

  removePost = postId => {
    this.setState(prevState => {
      const postExists = prevState.posts.some(post => post._id === postId);
      const totalPosts = Math.max(prevState.totalPosts - 1, 0);

      if (!postExists) {
        return {
          totalPosts
        };
      }

      return {
        posts: prevState.posts.filter(post => post._id !== postId),
        totalPosts,
        postsLoading: false
      };
    });
  };

  startEditPostHandler = postId => {
    this.setState(prevState => {
      const loadedPost = { ...prevState.posts.find(p => p._id === postId) };

      return {
        isEditing: true,
        editPost: loadedPost
      };
    });
  };

  cancelEditHandler = () => {
    this.setState({ isEditing: false, editPost: null });
  };

  isBase64Image = image =>
    typeof image === 'string' && image.startsWith('data:image/');

  finishEditHandler = async postData => {
    const wasEditing = !!this.state.editPost;

    this.setState({
      editLoading: true
    });

    const postInput = {
      title: postData.title,
      content: postData.content,
      // New files arrive as base64 strings; existing posts reuse their old image path.
      image: this.isBase64Image(postData.image) ? postData.image : null,
      oldImagePath:
        this.state.editPost && !this.isBase64Image(postData.image)
          ? this.state.editPost.imageUrl
          : null
    };

    try {
      const data = await graphqlRequest({
        query: this.state.editPost
          ? `
              mutation UpdatePost($id: ID!, $postInput: PostInputData!) {
                updatePost(id: $id, postInput: $postInput) {
                  _id
                  title
                  content
                  imageUrl
                  createdAt
                  creator {
                    _id
                    name
                  }
                }
              }
            `
          : `
              mutation CreatePost($postInput: PostInputData!) {
                createPost(postInput: $postInput) {
                  _id
                  title
                  content
                  imageUrl
                  createdAt
                  creator {
                    _id
                    name
                  }
                }
              }
            `,
        variables: this.state.editPost
          ? {
              id: this.state.editPost._id,
              postInput
            }
          : {
              postInput
            },
        token: this.props.token
      });
      const post = this.state.editPost ? data.updatePost : data.createPost;

      this.setState(prevState => {
        let updatedPosts = [...prevState.posts];
        if (prevState.editPost) {
          const postIndex = prevState.posts.findIndex(
            p => p._id === prevState.editPost._id
          );
          updatedPosts[postIndex] = post;
        }
        return {
          posts: updatedPosts,
          isEditing: false,
          editPost: null,
          editLoading: false
        };
      });

      if (!wasEditing) {
        this.addPost(post);
      } else {
        this.updatePost(post);
      }
    } catch (err) {
      console.log(err);
      this.setState({
        isEditing: false,
        editPost: null,
        editLoading: false,
        error: err
      });
    }
  };

  statusInputChangeHandler = (input, value) => {
    this.setState({ [input]: value });
  };

  deletePostHandler = async postId => {
    this.setState({ postsLoading: true });
    try {
      await graphqlRequest({
        query: `
          mutation DeletePost($id: ID!) {
            deletePost(id: $id)
          }
        `,
        variables: {
          id: postId
        },
        token: this.props.token
      });
      this.removePost(postId);
    } catch (err) {
      console.log(err);
      this.setState({ postsLoading: false });
    }
  };

  errorHandler = () => {
    this.setState({ error: null });
  };

  catchError = error => {
    this.setState({ error: error });
  };

  render() {
    return (
      <Fragment>
        <ErrorHandler error={this.state.error} onHandle={this.errorHandler} />
        <FeedEdit
          editing={this.state.isEditing}
          selectedPost={this.state.editPost}
          loading={this.state.editLoading}
          onCancelEdit={this.cancelEditHandler}
          onFinishEdit={this.finishEditHandler}
        />
        <section className="feed__status">
          <form onSubmit={this.statusUpdateHandler}>
            <Input
              id="status"
              type="text"
              placeholder="Your status"
              control="input"
              onChange={this.statusInputChangeHandler}
              value={this.state.status}
            />
            <Button mode="flat" type="submit">
              Update
            </Button>
          </form>
        </section>
        <section className="feed__control">
          <Button mode="raised" design="accent" onClick={this.newPostHandler}>
            New Post
          </Button>
        </section>
        <section className="feed">
          {this.state.postsLoading && (
            <div style={{ textAlign: 'center', marginTop: '2rem' }}>
              <Loader />
            </div>
          )}
          {this.state.posts.length <= 0 && !this.state.postsLoading ? (
            <p style={{ textAlign: 'center' }}>No posts found.</p>
          ) : null}
          {!this.state.postsLoading && (
            <Paginator
              onPrevious={this.loadPosts.bind(this, 'previous')}
              onNext={this.loadPosts.bind(this, 'next')}
              lastPage={Math.ceil(this.state.totalPosts / 2)}
              currentPage={this.state.postPage}
            >
              {this.state.posts.map(post => (
                <Post
                  key={post._id}
                  id={post._id}
                  author={post.creator.name}
                  date={new Date(post.createdAt).toLocaleDateString('en-US')}
                  title={post.title}
                  image={post.imageUrl}
                  content={post.content}
                  onStartEdit={this.startEditPostHandler.bind(this, post._id)}
                  onDelete={this.deletePostHandler.bind(this, post._id)}
                />
              ))}
            </Paginator>
          )}
        </section>
      </Fragment>
    );
  }
}

export default Feed;
