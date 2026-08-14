import { useState, type FormEvent } from 'react';

import Input from '../../components/Form/Input/Input';
import Button from '../../components/Button/Button';
import { required, length, email } from '../../util/validators';
import Auth from './Auth';

type LoginAuthData = {
  email: string;
  password: string;
};

type LoginProps = {
  loading: boolean;
  onLogin: (event: FormEvent<HTMLFormElement>, authData: LoginAuthData) => void | Promise<void>;
};

type Validator = (value: string) => boolean;
type LoginFieldId = keyof LoginAuthData;

type FormField = {
  value: string;
  valid: boolean;
  touched: boolean;
  validators: Validator[];
};

type LoginForm = Record<LoginFieldId, FormField>;

const INITIAL_LOGIN_FORM: LoginForm = {
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
  }
};

const Login = (props: LoginProps) => {
  const [loginForm, setLoginForm] = useState(INITIAL_LOGIN_FORM);
  const formIsValid = Object.values(loginForm).every((field) => field.valid);

  const inputChangeHandler = (input: string, value: string) => {
    if (input !== 'email' && input !== 'password') {
      return;
    }

    setLoginForm((prevLoginForm) => {
      let isValid = true;
      for (const validator of prevLoginForm[input].validators) {
        isValid = isValid && validator(value);
      }
      const updatedForm = {
        ...prevLoginForm,
        [input]: {
          ...prevLoginForm[input],
          valid: isValid,
          value: value
        }
      };
      return updatedForm;
    });
  };

  const inputBlurHandler = (input: LoginFieldId) => {
    setLoginForm((prevLoginForm) => {
      return {
        ...prevLoginForm,
        [input]: {
          ...prevLoginForm[input],
          touched: true
        }
      };
    });
  };

  return (
    <Auth>
      <form
        onSubmit={(e) =>
          props.onLogin(e, {
            email: loginForm.email.value,
            password: loginForm.password.value
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
          value={loginForm['email'].value}
          valid={loginForm['email'].valid}
          touched={loginForm['email'].touched}
        />
        <Input
          id="password"
          label="Password"
          type="password"
          required
          control="input"
          onChange={inputChangeHandler}
          onBlur={() => inputBlurHandler('password')}
          value={loginForm['password'].value}
          valid={loginForm['password'].valid}
          touched={loginForm['password'].touched}
        />
        <Button design="raised" type="submit" loading={props.loading} disabled={!formIsValid}>
          Login
        </Button>
      </form>
    </Auth>
  );
};

export default Login;
