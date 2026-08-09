// Thin wrapper around Image that enforces a square avatar size.
import React from 'react';

import Image from './Image';
import './Avatar.css';

type AvatarProps = {
  image?: string;
  size: number;
};

// Renders a square avatar using the shared image renderer.
const avatar = (props: AvatarProps) => (
  <div className="avatar" style={{ width: props.size + 'rem', height: props.size + 'rem' }}>
    <Image imageUrl={props.image} />
  </div>
);

export default avatar;
