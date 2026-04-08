import React, { Component, Fragment } from 'react';

import Post from '../../components/Feed/Post/Post';
import Button from '../../components/Button/Button';
import FeedEdit from '../../components/Feed/FeedEdit/FeedEdit';
import Input from '../../components/Form/Input/Input';
import Paginator from '../../components/Paginator/Paginator';
import Loader from '../../components/Loader/Loader';
import ErrorHandler from '../../components/ErrorHandler/ErrorHandler';
import { API_URL } from '../../config';
import './Feed.css';

class Feed extends Component {
  state = {
    isEditing: false,
    posts: [],
    totalPosts: 0,
    editPost: null,
    status: '',
    postPage: 1,
    postsLoading: true,
    editLoading: false
  };

  componentDidMount() {
    this.loadInitialData();
  }

  loadInitialData = async () => {
    try {
      const res = await fetch(`${API_URL}/feed/status`, {
        headers: {
          Authorization: 'Bearer ' + this.props.token
        }
      });

      if (res.status !== 200) {
        throw new Error('Failed to fetch user status.');
      }

      const resData = await res.json();
      this.setState({ status: resData.status });
      await this.loadPosts();
    } catch (error) {
      this.catchError(error);
    }
  };

  loadPosts = async direction => {
    try {
      if (direction) {
        this.setState({ postsLoading: true, posts: [] });
      }
      let page = this.state.postPage;
      if (direction === 'next') {
        page++;
        this.setState({ postPage: page });
      }
      if (direction === 'previous') {
        page--;
        this.setState({ postPage: page });
      }

      const res = await fetch(`${API_URL}/feed/posts?page=${page}`, {
        headers: {
          Authorization: 'Bearer ' + this.props.token
        }
      });

      if (res.status !== 200) {
        throw new Error('Failed to fetch posts.');
      }

      const resData = await res.json();
      this.setState({
        posts: resData.posts,
        totalPosts: resData.totalItems,
        postsLoading: false
      });
    } catch (error) {
      this.catchError(error);
    }
  };

  statusUpdateHandler = async event => {
    event.preventDefault();
    try {
      const res = await fetch(`${API_URL}/feed/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + this.props.token
        },
        body: JSON.stringify({
          status: this.state.status
        })
      });

      if (res.status !== 200 && res.status !== 201) {
        throw new Error("Can't update status!");
      }
    } catch (error) {
      this.catchError(error);
    }
  };

  newPostHandler = () => {
    this.setState({ isEditing: true });
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

  finishEditHandler = async postData => {
    this.setState({
      editLoading: true
    });
    let url = `${API_URL}/feed/post`;
    let method = 'POST';
    if (this.state.editPost) {
      url = `${API_URL}/feed/post/${this.state.editPost._id}`;
      method = 'PUT';
    }

    const formData = new FormData();
    formData.append('title', postData.title);
    formData.append('content', postData.content);
    if (postData.image instanceof File) {
      formData.append('image', postData.image);
    }
    if (this.state.editPost && this.state.editPost.imageUrl) {
      formData.append('oldPath', this.state.editPost.imageUrl);
    }

    try {
      const res = await fetch(url, {
        method: method,
        headers: {
          Authorization: 'Bearer ' + this.props.token
        },
        body: formData
      });

      if (res.status !== 200 && res.status !== 201) {
        throw new Error('Creating or editing a post failed!');
      }

      const resData = await res.json();
      const post = {
        _id: resData.post._id,
        title: resData.post.title,
        content: resData.post.content,
        imageUrl: resData.post.imageUrl,
        creator: resData.post.creator,
        createdAt: resData.post.createdAt
      };
      this.setState(prevState => {
        let updatedPosts = [...prevState.posts];
        if (prevState.editPost) {
          const postIndex = prevState.posts.findIndex(
            p => p._id === prevState.editPost._id
          );
          updatedPosts[postIndex] = post;
        } else if (prevState.posts.length < 2) {
          updatedPosts = prevState.posts.concat(post);
        }
        return {
          posts: updatedPosts,
          isEditing: false,
          editPost: null,
          editLoading: false
        };
      });
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
    void input;
    this.setState({ status: value });
  };

  deletePostHandler = async postId => {
    this.setState({ postsLoading: true });
    try {
      const res = await fetch(`${API_URL}/feed/post/${postId}`, {
        method: 'DELETE',
        headers: {
          Authorization: 'Bearer ' + this.props.token
        }
      });

      if (res.status !== 200 && res.status !== 201) {
        throw new Error('Deleting a post failed!');
      }

      await res.json();
      this.setState(prevState => {
        const updatedPosts = prevState.posts.filter(p => p._id !== postId);
        return { posts: updatedPosts, postsLoading: false };
      });
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
