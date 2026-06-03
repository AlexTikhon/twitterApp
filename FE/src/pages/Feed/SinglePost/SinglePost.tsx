// Loads a single post view from GraphQL using the route post id.
import React, { Component } from 'react';
import { useParams } from 'react-router-dom';

import Image from '../../../components/Image/Image';
import { graphqlRequest } from '../../../util/graphql';
import './SinglePost.css';

class SinglePost extends Component<any, any> {
  state = {
    title: '',
    author: '',
    date: '',
    image: '',
    content: ''
  };

  // Fetches the post details once the route parameter is available.
  componentDidMount() {
    this.loadPost();
  }

  // Loads one post by id and maps the GraphQL response into display state.
  loadPost = async () => {
    const postId = this.props.postId;
    try {
      const data = await graphqlRequest({
        query: `
          query GetPost($id: ID!) {
            post(id: $id) {
              title
              content
              imageUrl
              createdAt
              creator {
                name
              }
            }
          }
        `,
        variables: {
          id: postId
        },
        token: this.props.token
      });
      this.setState({
        title: data.post.title,
        author: data.post.creator.name,
        date: new Date(data.post.createdAt).toLocaleDateString('en-US'),
        image: data.post.imageUrl,
        content: data.post.content
      });
    } catch (err) {
      console.log(err);
    }
  };

  // Renders the loaded post details.
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

// Reads the React Router post id and passes it into the class component.
const SinglePostWithParams = props => {
  const { postId } = useParams();

  return <SinglePost {...props} postId={postId} />;
};

export default SinglePostWithParams;
