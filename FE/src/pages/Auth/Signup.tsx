// Handles the signup form state before App sends the GraphQL mutation.
import React, { useState } from 'react';

import Input from '../../components/Form/Input/Input';
import Button from '../../components/Button/Button';
import { required, length, email } from '../../util/validators';
import Auth from './Auth';

type SignupAuthData = {
  email: string;
  name: string;
  password: string;
};

type SignupProps = {
  loading: boolean;
  onSignup: (
    event: React.FormEvent<HTMLFormElement>,
    authData: SignupAuthData
  ) => void | Promise<void>;
};

type Validator = (value: string) => boolean;
type SignupFieldId = keyof SignupAuthData;

type FormField = {
  value: string;
  valid: boolean;
  touched: boolean;
  validators: Validator[];
};

type SignupForm = Record<SignupFieldId, FormField>;

const INITIAL_SIGNUP_FORM: SignupForm = {
  email: {
    value: '',
    valid: false,
    touched: false,
    validators: [required, email]
  },
  password: {
    value: '',
    valid: false,
    touched: false,
    validators: [required, length({ min: 5 })]
  },
  name: {
    value: '',
    valid: false,
    touched: false,
    validators: [required]
  }
};

const Signup = (props: SignupProps) => {
  const [signupForm, setSignupForm] = useState(INITIAL_SIGNUP_FORM);
  const formIsValid = Object.values(signupForm).every(field => field.valid);

  // Updates one signup field and recalculates the form validity.
  const inputChangeHandler = (input: SignupFieldId, value: string) => {
    setSignupForm(prevSignupForm => {
      let isValid = true;
      for (const validator of prevSignupForm[input].validators) {
        isValid = isValid && validator(value);
      }
      const updatedForm = {
        ...prevSignupForm,
        [input]: {
          ...prevSignupForm[input],
          valid: isValid,
          value: value
        }
      };
      return updatedForm;
    });
  };

  // Marks one signup field as touched after it loses focus.
  const inputBlurHandler = (input: SignupFieldId) => {
    setSignupForm(prevSignupForm => {
      return {
        ...prevSignupForm,
        [input]: {
          ...prevSignupForm[input],
          touched: true
        }
      };
    });
  };

  // Renders the signup form and delegates submit handling to App.
  return (
    <Auth>
      <form
        onSubmit={e =>
          props.onSignup(e, {
            email: signupForm.email.value,
            name: signupForm.name.value,
            password: signupForm.password.value
          })
        }
      >
        <Input
          id="email"
          label="Your E-Mail"
          type="email"
          control="input"
          onChange={inputChangeHandler}
          onBlur={() => inputBlurHandler('email')}
          value={signupForm['email'].value}
          valid={signupForm['email'].valid}
          touched={signupForm['email'].touched}
        />
        <Input
          id="name"
          label="Your Name"
          type="text"
          control="input"
          onChange={inputChangeHandler}
          onBlur={() => inputBlurHandler('name')}
          value={signupForm['name'].value}
          valid={signupForm['name'].valid}
          touched={signupForm['name'].touched}
        />
        <Input
          id="password"
          label="Password"
          type="password"
          control="input"
          onChange={inputChangeHandler}
          onBlur={() => inputBlurHandler('password')}
          value={signupForm['password'].value}
          valid={signupForm['password'].valid}
          touched={signupForm['password'].touched}
        />
        <Button
          design="raised"
          type="submit"
          loading={props.loading}
          disabled={!formIsValid}
        >
          Signup
        </Button>
      </form>
    </Auth>
  );
};

export default Signup;
