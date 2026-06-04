// Resolves relative backend image paths into full URLs before rendering them.
import React from 'react';

import { API_URL } from '../../config';
import './Image.css';

type ImageProps = {
  imageUrl?: string;
  contain?: boolean;
  left?: boolean;
};

// Converts backend-relative image paths into URLs the browser can load.
const resolveImageUrl = (imageUrl?: string) => {
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

// Renders an image as a CSS background with cover/contain positioning.
const image = (props: ImageProps) => (
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
