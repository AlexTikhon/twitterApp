// Coordinates authentication state and switches between auth routes and feed routes.
import React, { Fragment, useCallback, useEffect, useRef, useState } from 'react';
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
import { graphqlRequest } from './util/graphql';
import './App.css';

type AuthData = {
  email: string;
  password: string;
  name?: string;
};

type LoginResponse = {
  login: {
    token: string;
    userId: string;
    expiresIn: number;
  };
};

const App = () => {
  const navigate = useNavigate();
  const [showBackdrop, setShowBackdrop] = useState(false);
  const [showMobileNav, setShowMobileNav] = useState(false);
  const [isAuth, setIsAuth] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const logoutTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const logoutHandler = useCallback(() => {
    if (logoutTimer.current) {
      clearTimeout(logoutTimer.current);
      logoutTimer.current = null;
    }
    setIsAuth(false);
    setToken(null);
    setUserId(null);
    localStorage.removeItem('token');
    localStorage.removeItem('expiryDate');
    localStorage.removeItem('userId');
  }, []);

  const setAutoLogout = useCallback(
    (milliseconds: number) => {
      if (logoutTimer.current) {
        clearTimeout(logoutTimer.current);
      }
      // The timeout mirrors the JWT expiry so stale tokens are cleared automatically.
      logoutTimer.current = setTimeout(() => {
        logoutHandler();
      }, milliseconds);
    },
    [logoutHandler]
  );

  // Restores a saved login session when the app first mounts.
  useEffect(() => {
    // Reuse the saved session until the stored expiry time has passed.
    const storedToken = localStorage.getItem('token');
    const expiryDate = localStorage.getItem('expiryDate');
    if (!storedToken || !expiryDate) {
      return;
    }
    if (new Date(expiryDate) <= new Date()) {
      logoutHandler();
      return;
    }
    const storedUserId = localStorage.getItem('userId');
    const remainingMilliseconds = new Date(expiryDate).getTime() - new Date().getTime();
    setIsAuth(true);
    setToken(storedToken);
    setUserId(storedUserId);
    setAutoLogout(remainingMilliseconds);

    return () => {
      if (logoutTimer.current) {
        clearTimeout(logoutTimer.current);
      }
    };
  }, [logoutHandler, setAutoLogout]);

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
      const data = await graphqlRequest<LoginResponse>({
        query: `
					mutation Login($email: String!, $password: String!) {
						login(email: $email, password: $password) {
							token
							userId
							expiresIn
						}
					}
				`,
        variables: authData
      });

      setIsAuth(true);
      setToken(data.login.token);
      setAuthLoading(false);
      setUserId(data.login.userId);
      localStorage.setItem('token', data.login.token);
      localStorage.setItem('userId', data.login.userId);
      // The backend returns the token lifetime in seconds.
      const remainingMilliseconds = data.login.expiresIn * 1000;
      const expiryDate = new Date(new Date().getTime() + remainingMilliseconds);
      localStorage.setItem('expiryDate', expiryDate.toISOString());
      setAutoLogout(remainingMilliseconds);
    } catch (err) {
      console.log(err);
      setIsAuth(false);
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
        query: `
					mutation CreateUser($email: String!, $name: String!, $password: String!) {
						createUser(
							userInput: { email: $email, name: $name, password: $password }
						) {
							_id
						}
					}
				`,
        variables: authData
      });
      setIsAuth(false);
      setAuthLoading(false);
      navigate('/');
    } catch (err) {
      console.log(err);
      setIsAuth(false);
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
  if (isAuth) {
    // Authenticated users can access the feed and individual post pages.
    routes = (
      <Routes>
        <Route
          path="/"
          element={<FeedPage userId={userId} token={token} onLogout={logoutHandler} />}
        />
        <Route
          path="/:postId"
          element={<SinglePostPage userId={userId} token={token} onLogout={logoutHandler} />}
        />
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
              isAuth={isAuth}
            />
          </Toolbar>
        }
        mobileNav={
          <MobileNavigation
            open={showMobileNav}
            mobile
            onChooseItem={() => mobileNavHandler(false)}
            onLogout={logoutHandler}
            isAuth={isAuth}
          />
        }
      />
      {routes}
    </Fragment>
  );
};

export default App;
