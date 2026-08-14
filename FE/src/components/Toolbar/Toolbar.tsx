import type { ReactNode } from 'react';

import './Toolbar.css';

type ToolbarProps = {
  children: ReactNode;
};

const toolbar = (props: ToolbarProps) => <div className="toolbar">{props.children}</div>;

export default toolbar;
