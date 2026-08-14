import React, { Fragment, useEffect, useState } from 'react';

import Backdrop from '../../Backdrop/Backdrop';
import Button from '../../Button/Button';
import Modal from '../../Modal/Modal';
import Input from '../../Form/Input/Input';
import FilePicker from '../../Form/Input/FilePicker';
import Image from '../../Image/Image';
import { required, length } from '../../../util/validators';

export type PostEditorData = {
  image: File | null;
  content: string;
  removeImage: boolean;
};

type FeedEditPost = {
  _id: string;
  content: string;
  imageUrl: string | null;
};

type FeedEditProps = {
  editing: boolean;
  selectedPost: FeedEditPost | null;
  loading: boolean;
  onCancelEdit: () => void;
  onFinishEdit: (post: PostEditorData) => void | Promise<void>;
};

type Validator = (value: string) => boolean;
type PostFormFieldId = 'image' | 'content';

type PostFormField = {
  value: string;
  valid: boolean;
  touched: boolean;
  validators: Validator[];
};

type PostForm = Record<PostFormFieldId, PostFormField>;

const POST_FORM: PostForm = {
  image: {
    value: '',
    valid: true,
    touched: false,
    validators: []
  },
  content: {
    value: '',
    valid: false,
    touched: false,
    validators: [required, length({ max: 500 })]
  }
};

const FeedEdit = (props: FeedEditProps) => {
  const [postForm, setPostForm] = useState(POST_FORM);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [removeImage, setRemoveImage] = useState(false);

  const getFormIsValid = (updatedForm: PostForm) => {
    let nextFormIsValid = true;
    for (const inputName of Object.keys(updatedForm) as PostFormFieldId[]) {
      nextFormIsValid = nextFormIsValid && updatedForm[inputName].valid;
    }
    return nextFormIsValid;
  };

  const formIsValid = getFormIsValid(postForm);

  useEffect(() => {
    if (props.editing && !props.selectedPost) {
      setPostForm(POST_FORM);
      setImagePreview((previousPreview) => {
        if (previousPreview?.startsWith('blob:')) {
          URL.revokeObjectURL(previousPreview);
        }
        return null;
      });
      setSelectedImage(null);
      setRemoveImage(false);
      return;
    }

    if (props.editing && props.selectedPost) {
      const postForm = {
        image: {
          ...POST_FORM.image,
          value: props.selectedPost.imageUrl || '',
          valid: true
        },
        content: {
          ...POST_FORM.content,
          value: props.selectedPost.content,
          valid: true
        }
      };
      setPostForm(postForm);
      setImagePreview((previousPreview) => {
        if (previousPreview?.startsWith('blob:')) {
          URL.revokeObjectURL(previousPreview);
        }
        return props.selectedPost?.imageUrl || null;
      });
      setSelectedImage(null);
      setRemoveImage(false);
    }
  }, [props.editing, props.selectedPost]);

  const postInputChangeHandler = (input: string, value: string, files?: FileList | null) => {
    if (input !== 'image' && input !== 'content') {
      return;
    }

    let updatedValue = value;

    if (input === 'image' && files && files.length > 0) {
      const imageFile = files[0];
      updatedValue = imageFile.name;
      setSelectedImage(imageFile);
      setRemoveImage(false);
      setImagePreview((previousPreview) => {
        if (previousPreview?.startsWith('blob:')) {
          URL.revokeObjectURL(previousPreview);
        }
        return URL.createObjectURL(imageFile);
      });
    } else if (input === 'image') {
      updatedValue = '';
      setSelectedImage(null);
      setImagePreview((previousPreview) => {
        if (previousPreview?.startsWith('blob:')) {
          URL.revokeObjectURL(previousPreview);
        }
        return null;
      });
    }
    setPostForm((prevPostForm) => {
      let isValid = true;
      for (const validator of prevPostForm[input].validators) {
        isValid = isValid && validator(updatedValue);
      }
      const updatedForm = {
        ...prevPostForm,
        [input]: {
          ...prevPostForm[input],
          valid: isValid,
          value: updatedValue
        }
      };
      return updatedForm;
    });
  };

  const inputBlurHandler = (input: PostFormFieldId) => {
    setPostForm((prevPostForm) => {
      return {
        ...prevPostForm,
        [input]: {
          ...prevPostForm[input],
          touched: true
        }
      };
    });
  };

  const cancelPostChangeHandler = () => {
    setPostForm(POST_FORM);
    setImagePreview((previousPreview) => {
      if (previousPreview?.startsWith('blob:')) {
        URL.revokeObjectURL(previousPreview);
      }
      return null;
    });
    setSelectedImage(null);
    setRemoveImage(false);
    props.onCancelEdit();
  };

  const acceptPostChangeHandler = () => {
    const post = {
      image: selectedImage,
      content: postForm.content.value,
      removeImage
    };
    props.onFinishEdit(post);
    setPostForm(POST_FORM);
    setImagePreview((previousPreview) => {
      if (previousPreview?.startsWith('blob:')) {
        URL.revokeObjectURL(previousPreview);
      }
      return null;
    });
    setSelectedImage(null);
    setRemoveImage(false);
  };

  return props.editing ? (
    <Fragment>
      <Backdrop onClick={cancelPostChangeHandler} />
      <Modal
        title={props.selectedPost ? 'Edit post' : 'New post'}
        acceptEnabled={formIsValid}
        onCancelModal={cancelPostChangeHandler}
        onAcceptModal={acceptPostChangeHandler}
        isLoading={props.loading}
      >
        <form>
          <FilePicker
            id="image"
            label="Image (optional)"
            control="input"
            onChange={postInputChangeHandler}
            onBlur={() => inputBlurHandler('image')}
            valid={postForm['image'].valid}
            touched={postForm['image'].touched}
          />
          <div className="new-post__preview-image">
            {!imagePreview && <p>No image selected.</p>}
            {imagePreview && <Image imageUrl={imagePreview} alt="Post preview" contain left />}
          </div>
          {imagePreview && (
            <Button
              type="button"
              mode="flat"
              design="danger"
              onClick={() => {
                if (imagePreview.startsWith('blob:')) {
                  URL.revokeObjectURL(imagePreview);
                }
                setImagePreview(null);
                setSelectedImage(null);
                setRemoveImage(Boolean(props.selectedPost?.imageUrl));
              }}
            >
              Remove image
            </Button>
          )}
          <Input
            id="content"
            label="Content"
            control="textarea"
            rows="5"
            maxLength={500}
            onChange={postInputChangeHandler}
            onBlur={() => inputBlurHandler('content')}
            valid={postForm['content'].valid}
            touched={postForm['content'].touched}
            value={postForm['content'].value}
          />
          <p className="new-post__character-count" aria-live="polite">
            {postForm.content.value.length}/500
          </p>
        </form>
      </Modal>
    </Fragment>
  ) : null;
};

export default FeedEdit;
