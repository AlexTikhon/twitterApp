import { useMutation } from '@apollo/client';
import { Fragment, useCallback, useEffect, useState, type FormEvent } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';

import Layout from './components/Layout/Layout';
import Backdrop from './components/Backdrop/Backdrop';
import Toolbar from './components/Toolbar/Toolbar';
import MainNavigation from './components/Navigation/MainNavigation/MainNavigation';
import MobileNavigation from './components/Navigation/MobileNavigation/MobileNavigation';
import ErrorHandler from './components/ErrorHandler/ErrorHandler';
import FeedPage from './pages/Feed/Feed';
import SinglePostPage from './pages/Feed/SinglePost/SinglePost';
import UserProfilePage from './pages/Profile/UserProfile';
import LoginPage from './pages/Auth/Login';
import SignupPage from './pages/Auth/Signup';
import { CreateUserDocument, LoginDocument } from './generated/graphql';
import { useSession } from './hooks/useSession';
import { usePostsRealtime } from './hooks/usePostsRealtime';
import { clearSession, saveSession } from './session';
import { apolloClient } from './apollo';

type LoginData = {
  email: string;
  password: string;
};

type SignupData = LoginData & { name: string };

const App = () => {
  const navigate = useNavigate();
  const session = useSession();
  const [showBackdrop, setShowBackdrop] = useState(false);
  const [showMobileNav, setShowMobileNav] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [login] = useMutation(LoginDocument);
  const [createUser] = useMutation(CreateUserDocument);

  const logoutHandler = useCallback(() => {
    clearSession();
  }, []);

  usePostsRealtime({
    token: session?.token || null,
    onError: setError,
    onUnauthorized: logoutHandler
  });

  useEffect(() => {
    if (!session) {
      void apolloClient.clearStore();
    }
  }, [session]);

  const mobileNavHandler = (isOpen: boolean) => {
    setShowMobileNav(isOpen);
    setShowBackdrop(isOpen);
  };

  const backdropClickHandler = () => {
    setShowBackdrop(false);
    setShowMobileNav(false);
    setError(null);
  };

  const loginHandler = async (event: FormEvent<HTMLFormElement>, authData: LoginData) => {
    event.preventDefault();
    setAuthLoading(true);
    try {
      const { data } = await login({ variables: authData });
      if (!data) {
        throw new Error('Login returned no data.');
      }

      saveSession(data.login.token, data.login.userId, data.login.expiresIn);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Login failed.'));
    } finally {
      setAuthLoading(false);
    }
  };

  const signupHandler = async (event: FormEvent<HTMLFormElement>, authData: SignupData) => {
    event.preventDefault();
    setAuthLoading(true);
    try {
      await createUser({ variables: authData });
      clearSession();
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Signup failed.'));
    } finally {
      setAuthLoading(false);
    }
  };

  const errorHandler = () => {
    setError(null);
  };

  let routes = (
    <Routes>
      <Route path="/" element={<LoginPage onLogin={loginHandler} loading={authLoading} />} />
      <Route
        path="/signup"
        element={<SignupPage onSignup={signupHandler} loading={authLoading} />}
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
  if (session) {
    routes = (
      <Routes>
        <Route path="/" element={<FeedPage userId={session.userId} />} />
        <Route path="/posts/:postId" element={<SinglePostPage />} />
        <Route path="/users/:userId" element={<UserProfilePage currentUserId={session.userId} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }
  return (
    <Fragment>
      {showBackdrop && <Backdrop onClick={backdropClickHandler} />}
      <ErrorHandler error={error} onHandle={errorHandler} />
      <Layout
        header={
          <Toolbar>
            <MainNavigation
              mobileNavOpen={showMobileNav}
              onOpenMobileNav={() => mobileNavHandler(true)}
              onLogout={logoutHandler}
              isAuth={Boolean(session)}
            />
          </Toolbar>
        }
        mobileNav={
          <MobileNavigation
            open={showMobileNav}
            onChooseItem={() => mobileNavHandler(false)}
            onLogout={logoutHandler}
            isAuth={Boolean(session)}
          />
        }
      >
        {routes}
      </Layout>
    </Fragment>
  );
};

export default App;
