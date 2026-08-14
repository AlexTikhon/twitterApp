import { useEffect, useRef, type KeyboardEvent } from 'react';

import NavigationItems from '../NavigationItems/NavigationItems';
import './MobileNavigation.css';

type MobileNavigationProps = {
  open: boolean;
  isAuth: boolean;
  onChooseItem: () => void;
  onLogout: () => void;
};

const MobileNavigation = (props: MobileNavigationProps) => {
  const navigationRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!props.open) {
      return;
    }

    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    navigationRef.current?.querySelector<HTMLElement>('a, button')?.focus();
    return () => previouslyFocused?.focus();
  }, [props.open]);

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') {
      props.onChooseItem();
      return;
    }
    if (event.key !== 'Tab') {
      return;
    }

    const focusable = [
      ...(navigationRef.current?.querySelectorAll<HTMLElement>('a, button') || [])
    ];
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  };

  return (
    <nav
      ref={navigationRef}
      id="mobile-navigation"
      className={['mobile-nav', props.open ? 'open' : ''].join(' ')}
      aria-label="Mobile navigation"
      aria-hidden={!props.open}
      inert={!props.open}
      onKeyDown={handleKeyDown}
    >
      <ul className="mobile-nav__items mobile">
        <NavigationItems
          mobile
          onChoose={props.onChooseItem}
          isAuth={props.isAuth}
          onLogout={props.onLogout}
        />
      </ul>
    </nav>
  );
};

export default MobileNavigation;
