// Builds the nav links based on whether the user is authenticated.
import React from 'react';
import { NavLink } from 'react-router-dom';

import './NavigationItems.css';

const navItems = [
  { id: 'feed', text: 'Feed', link: '/', auth: true },
  { id: 'login', text: 'Login', link: '/', auth: false },
  { id: 'signup', text: 'Signup', link: '/signup', auth: false }
];

type NavigationItemsProps = {
  isAuth: boolean;
  mobile?: boolean;
  onChoose?: () => void;
  onLogout: () => void;
};

// Filters nav links by auth state and appends the logout action when needed.
const navigationItems = (props: NavigationItemsProps) => (
  <>
    {navItems
      .filter(item => item.auth === props.isAuth)
      .map(item => (
        <li
          key={item.id}
          className={['navigation-item', props.mobile ? 'mobile' : ''].join(
            ' '
          )}
        >
          <NavLink
            to={item.link}
            end
            onClick={props.onChoose}
            className={({ isActive }) => (isActive ? 'active' : undefined)}
          >
            {item.text}
          </NavLink>
        </li>
      ))}
    {props.isAuth && (
      <li className="navigation-item" key="logout">
        <button onClick={props.onLogout}>Logout</button>
      </li>
    )}
  </>
);

export default navigationItems;
