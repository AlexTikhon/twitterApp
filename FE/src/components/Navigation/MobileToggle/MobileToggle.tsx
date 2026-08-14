import './MobileToggle.css';

type MobileToggleProps = {
  open: boolean;
  onOpen: () => void;
};

const mobileToggle = (props: MobileToggleProps) => (
  <button
    className="mobile-toggle"
    onClick={props.onOpen}
    aria-label="Open navigation"
    aria-controls="mobile-navigation"
    aria-expanded={props.open}
  >
    <span className="mobile-toggle__bar" />
    <span className="mobile-toggle__bar" />
    <span className="mobile-toggle__bar" />
  </button>
);

export default mobileToggle;
