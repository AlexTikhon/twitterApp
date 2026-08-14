import { API_URL } from '../../config';
import './Image.css';

type ImageProps = {
  imageUrl?: string | null;
  alt: string;
  contain?: boolean;
  left?: boolean;
};

const resolveImageUrl = (imageUrl?: string | null) => {
  if (!imageUrl) {
    return '';
  }

  if (
    imageUrl.startsWith('http://') ||
    imageUrl.startsWith('https://') ||
    imageUrl.startsWith('data:') ||
    imageUrl.startsWith('blob:')
  ) {
    return imageUrl;
  }

  return `${API_URL}${imageUrl}`;
};

const Image = ({ imageUrl, alt, contain, left }: ImageProps) => (
  <img
    className="image"
    src={resolveImageUrl(imageUrl)}
    alt={alt}
    style={{
      objectFit: contain ? 'contain' : 'cover',
      objectPosition: left ? 'left' : 'center'
    }}
  />
);

export default Image;
