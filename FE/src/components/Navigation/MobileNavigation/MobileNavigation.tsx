// Slide-in navigation used on smaller screens.
import React from 'react';

import NavigationItems from '../NavigationItems/NavigationItems';
import './MobileNavigation.css';

type MobileNavigationProps = {
  open: boolean;
  mobile?: boolean;
  isAuth: boolean;
  onChooseItem: () => void;
  onLogout: () => void;
};

// Renders the slide-in mobile nav with the same auth-aware items.
const mobileNavigation = (props: MobileNavigationProps) => (
  <nav className={['mobile-nav', props.open ? 'open' : ''].join(' ')}>
    <ul
      className={['mobile-nav__items', props.mobile ? 'mobile' : ''].join(' ')}
    >
      <NavigationItems
        mobile
        onChoose={props.onChooseItem}
        isAuth={props.isAuth}
        onLogout={props.onLogout}
      />
    </ul>
  </nav>
);

export default mobileNavigation;
