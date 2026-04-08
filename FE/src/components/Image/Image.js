import React from 'react';

import { API_URL } from '../../config';
import './Image.css';

const resolveImageUrl = imageUrl => {
  if (!imageUrl) {
    return '';
  }

  if (
    imageUrl.startsWith('http://') ||
    imageUrl.startsWith('https://') ||
    imageUrl.startsWith('data:')
  ) {
    return imageUrl;
  }

  return `${API_URL}${imageUrl}`;
};

const image = props => (
  <div
    className="image"
    style={{
      backgroundImage: `url('${resolveImageUrl(props.imageUrl)}')`,
      backgroundSize: props.contain ? 'contain' : 'cover',
      backgroundPosition: props.left ? 'left' : 'center'
    }}
  />
);

export default image;
