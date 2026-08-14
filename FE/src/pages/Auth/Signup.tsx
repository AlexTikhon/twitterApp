import { useState, type FormEvent } from 'react';

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
  onSignup: (event: FormEvent<HTMLFormElement>, authData: SignupAuthData) => void | Promise<void>;
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
    validators: [required, email, length({ max: 254 })]
  },
  password: {
    value: '',
    valid: false,
    touched: false,
    validators: [required, length({ min: 8, max: 72 })]
  },
  name: {
    value: '',
    valid: false,
    touched: false,
    validators: [required, length({ max: 80 })]
  }
};

const Signup = (props: SignupProps) => {
  const [signupForm, setSignupForm] = useState(INITIAL_SIGNUP_FORM);
  const formIsValid = Object.values(signupForm).every((field) => field.valid);

  const inputChangeHandler = (input: string, value: string) => {
    if (input !== 'email' && input !== 'password' && input !== 'name') {
      return;
    }

    setSignupForm((prevSignupForm) => {
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

  const inputBlurHandler = (input: SignupFieldId) => {
    setSignupForm((prevSignupForm) => {
      return {
        ...prevSignupForm,
        [input]: {
          ...prevSignupForm[input],
          touched: true
        }
      };
    });
  };

  return (
    <Auth>
      <form
        onSubmit={(e) =>
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
          required
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
          required
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
          required
          control="input"
          onChange={inputChangeHandler}
          onBlur={() => inputBlurHandler('password')}
          value={signupForm['password'].value}
          valid={signupForm['password'].valid}
          touched={signupForm['password'].touched}
        />
        <Button design="raised" type="submit" loading={props.loading} disabled={!formIsValid}>
          Signup
        </Button>
      </form>
    </Auth>
  );
};

export default Signup;
