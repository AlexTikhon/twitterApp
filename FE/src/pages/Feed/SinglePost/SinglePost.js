import React, { Component } from 'react';

import Image from '../../../components/Image/Image';
import { API_URL } from '../../../config';
import './SinglePost.css';

class SinglePost extends Component {
  state = {
    title: '',
    author: '',
    date: '',
    image: '',
    content: ''
  };

  componentDidMount() {
    this.loadPost();
  }

  loadPost = async () => {
    const postId = this.props.match.params.postId;
    try {
      const res = await fetch(`${API_URL}/feed/post/${postId}`, {
        headers: {
          Authorization: 'Bearer ' + this.props.token
        }
      });

      if (res.status !== 200) {
        throw new Error('Failed to fetch status');
      }

      const resData = await res.json();
      this.setState({
        title: resData.post.title,
        author: resData.post.creator.name,
        date: new Date(resData.post.createdAt).toLocaleDateString('en-US'),
        image: resData.post.imageUrl,
        content: resData.post.content
      });
    } catch (err) {
      console.log(err);
    }
  };

  render() {
    return (
      <section className="single-post">
        <h1>{this.state.title}</h1>
        <h2>
          Created by {this.state.author} on {this.state.date}
        </h2>
        <div className="single-post__image">
          <Image contain imageUrl={this.state.image} />
        </div>
        <p>{this.state.content}</p>
      </section>
    );
  }
}

export default SinglePost;
