// Modal form used for both creating a post and editing an existing one.
import React, { Fragment, useEffect, useState } from 'react';

import Backdrop from '../../Backdrop/Backdrop';
import Modal from '../../Modal/Modal';
import Input from '../../Form/Input/Input';
import FilePicker from '../../Form/Input/FilePicker';
import Image from '../../Image/Image';
import { required, length } from '../../../util/validators';

export type PostEditorData = {
  title: string;
  image: File | null;
  content: string;
};

type FeedEditPost = {
  _id: string;
  title: string;
  content: string;
  imageUrl: string;
};

type FeedEditProps = {
  editing: boolean;
  selectedPost: FeedEditPost | null;
  loading: boolean;
  onCancelEdit: () => void;
  onFinishEdit: (post: PostEditorData) => void | Promise<void>;
};

type Validator = (value: string) => boolean;
type PostFormFieldId = 'title' | 'image' | 'content';

type PostFormField = {
  value: string;
  valid: boolean;
  touched: boolean;
  validators: Validator[];
};

type PostForm = Record<PostFormFieldId, PostFormField>;

const POST_FORM: PostForm = {
  title: {
    value: '',
    valid: false,
    touched: false,
    validators: [required, length({ min: 5, max: 120 })]
  },
  image: {
    value: '',
    valid: false,
    touched: false,
    validators: [required]
  },
  content: {
    value: '',
    valid: false,
    touched: false,
    validators: [required, length({ min: 5, max: 5000 })]
  }
};

const FeedEdit = (props: FeedEditProps) => {
  const [postForm, setPostForm] = useState(POST_FORM);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);

  const getFormIsValid = (updatedForm: PostForm) => {
    let nextFormIsValid = true;
    for (const inputName of Object.keys(updatedForm) as PostFormFieldId[]) {
      nextFormIsValid = nextFormIsValid && updatedForm[inputName].valid;
    }
    return nextFormIsValid;
  };

  const formIsValid = getFormIsValid(postForm);

  // Resets or preloads the form whenever the editor modal opens.
  useEffect(() => {
    // Opening the modal for a new post resets the form to its empty state.
    if (props.editing && !props.selectedPost) {
      setPostForm(POST_FORM);
      setImagePreview((previousPreview) => {
        if (previousPreview?.startsWith('blob:')) {
          URL.revokeObjectURL(previousPreview);
        }
        return null;
      });
      setSelectedImage(null);
      return;
    }

    if (props.editing && props.selectedPost) {
      const postForm = {
        title: {
          ...POST_FORM.title,
          value: props.selectedPost.title,
          valid: true
        },
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
      // Existing posts show the stored image immediately in the preview area.
      setImagePreview((previousPreview) => {
        if (previousPreview?.startsWith('blob:')) {
          URL.revokeObjectURL(previousPreview);
        }
        return props.selectedPost?.imageUrl || null;
      });
      setSelectedImage(null);
    }
  }, [props.editing, props.selectedPost]);

  // Updates field state and creates a local preview without serializing the file into GraphQL.
  const postInputChangeHandler = (
    input: PostFormFieldId,
    value: string,
    files?: FileList | null
  ) => {
    let updatedValue = value;

    if (input === 'image' && files && files.length > 0) {
      const imageFile = files[0];
      updatedValue = imageFile.name;
      setSelectedImage(imageFile);
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

  // Marks a field as touched so validation styling can appear.
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

  // Resets editor state and informs the parent that editing was cancelled.
  const cancelPostChangeHandler = () => {
    setPostForm(POST_FORM);
    setImagePreview((previousPreview) => {
      if (previousPreview?.startsWith('blob:')) {
        URL.revokeObjectURL(previousPreview);
      }
      return null;
    });
    setSelectedImage(null);
    props.onCancelEdit();
  };

  // Emits the current post form payload and resets the modal state.
  const acceptPostChangeHandler = () => {
    const post = {
      title: postForm.title.value,
      image: selectedImage,
      content: postForm.content.value
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
  };

  // Renders the modal editor only while the parent marks it as open.
  return props.editing ? (
    <Fragment>
      <Backdrop onClick={cancelPostChangeHandler} />
      <Modal
        title="New Post"
        acceptEnabled={formIsValid}
        onCancelModal={cancelPostChangeHandler}
        onAcceptModal={acceptPostChangeHandler}
        isLoading={props.loading}
      >
        <form>
          <Input
            id="title"
            label="Title"
            control="input"
            onChange={postInputChangeHandler}
            onBlur={() => inputBlurHandler('title')}
            valid={postForm['title'].valid}
            touched={postForm['title'].touched}
            value={postForm['title'].value}
          />
          <FilePicker
            id="image"
            label="Image"
            control="input"
            onChange={postInputChangeHandler}
            onBlur={() => inputBlurHandler('image')}
            valid={postForm['image'].valid}
            touched={postForm['image'].touched}
          />
          <div className="new-post__preview-image">
            {!imagePreview && <p>Please choose an image.</p>}
            {imagePreview && <Image imageUrl={imagePreview} contain left />}
          </div>
          <Input
            id="content"
            label="Content"
            control="textarea"
            rows="5"
            onChange={postInputChangeHandler}
            onBlur={() => inputBlurHandler('content')}
            valid={postForm['content'].valid}
            touched={postForm['content'].touched}
            value={postForm['content'].value}
          />
        </form>
      </Modal>
    </Fragment>
  ) : null;
};

export default FeedEdit;
