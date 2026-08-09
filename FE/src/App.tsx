// Coordinates authentication state and switches between auth routes and feed routes.
import React, { Fragment, useCallback, useState } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';

import Layout from './components/Layout/Layout';
import Backdrop from './components/Backdrop/Backdrop';
import Toolbar from './components/Toolbar/Toolbar';
import MainNavigation from './components/Navigation/MainNavigation/MainNavigation';
import MobileNavigation from './components/Navigation/MobileNavigation/MobileNavigation';
import ErrorHandler from './components/ErrorHandler/ErrorHandler';
import FeedPage from './pages/Feed/Feed';
import SinglePostPage from './pages/Feed/SinglePost/SinglePost';
import LoginPage from './pages/Auth/Login';
import SignupPage from './pages/Auth/Signup';
import { CreateUserDocument, LoginDocument } from './generated/graphql';
import { useSession } from './hooks/useSession';
import { clearSession, saveSession } from './session';
import { graphqlRequest } from './util/graphql';
import './App.css';

type AuthData = {
  email: string;
  password: string;
  name?: string;
};

const App = () => {
  const navigate = useNavigate();
  const session = useSession();
  const [showBackdrop, setShowBackdrop] = useState(false);
  const [showMobileNav, setShowMobileNav] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const logoutHandler = useCallback(() => {
    clearSession();
  }, []);

  // Opens or closes the mobile navigation and matching backdrop together.
  const mobileNavHandler = (isOpen: boolean) => {
    setShowMobileNav(isOpen);
    setShowBackdrop(isOpen);
  };

  // Closes transient overlay UI and clears the visible error.
  const backdropClickHandler = () => {
    setShowBackdrop(false);
    setShowMobileNav(false);
    setError(null);
  };

  // Sends login credentials to GraphQL and stores the returned session.
  const loginHandler = async (event: React.FormEvent<HTMLFormElement>, authData: AuthData) => {
    event.preventDefault();
    setAuthLoading(true);
    try {
      const data = await graphqlRequest({
        document: LoginDocument,
        variables: authData
      });

      setAuthLoading(false);
      saveSession(data.login.token, data.login.userId, data.login.expiresIn);
    } catch (err) {
      console.log(err);
      setAuthLoading(false);
      setError(err instanceof Error ? err : new Error('Login failed.'));
    }
  };

  // Creates a user account and sends the user back to the login route.
  const signupHandler = async (event: React.FormEvent<HTMLFormElement>, authData: AuthData) => {
    event.preventDefault();
    setAuthLoading(true);
    try {
      await graphqlRequest({
        document: CreateUserDocument,
        variables: authData
      });
      clearSession();
      setAuthLoading(false);
      navigate('/');
    } catch (err) {
      console.log(err);
      setAuthLoading(false);
      setError(err instanceof Error ? err : new Error('Signup failed.'));
    }
  };

  // Clears the global error modal state.
  const errorHandler = () => {
    setError(null);
  };

  // Selects the route tree based on whether the user is authenticated.
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
    // Authenticated users can access the feed and individual post pages.
    routes = (
      <Routes>
        <Route
          path="/"
          element={
            <FeedPage userId={session.userId} token={session.token} onLogout={logoutHandler} />
          }
        />
        <Route path="/:postId" element={<SinglePostPage onLogout={logoutHandler} />} />
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
              onOpenMobileNav={() => mobileNavHandler(true)}
              onLogout={logoutHandler}
              isAuth={Boolean(session)}
            />
          </Toolbar>
        }
        mobileNav={
          <MobileNavigation
            open={showMobileNav}
            mobile
            onChooseItem={() => mobileNavHandler(false)}
            onLogout={logoutHandler}
            isAuth={Boolean(session)}
          />
        }
      />
      {routes}
    </Fragment>
  );
};

export default App;
