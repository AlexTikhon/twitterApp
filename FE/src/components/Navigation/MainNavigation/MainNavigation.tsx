import { NavLink } from 'react-router-dom';

import MobileToggle from '../MobileToggle/MobileToggle';
import Logo from '../../Logo/Logo';
import NavigationItems from '../NavigationItems/NavigationItems';

import './MainNavigation.css';

type MainNavigationProps = {
  isAuth: boolean;
  mobileNavOpen: boolean;
  onOpenMobileNav: () => void;
  onLogout: () => void;
};

const mainNavigation = (props: MainNavigationProps) => (
  <nav className="main-nav">
    <MobileToggle open={props.mobileNavOpen} onOpen={props.onOpenMobileNav} />
    <div className="main-nav__logo">
      <NavLink to="/">
        <Logo />
      </NavLink>
    </div>
    <div className="spacer" />
    <ul className="main-nav__items">
      <NavigationItems isAuth={props.isAuth} onLogout={props.onLogout} />
    </ul>
  </nav>
);

export default mainNavigation;
