// Simple container for aligning the main navigation content.
import React from 'react';

import './Toolbar.css';

type ToolbarProps = {
  children: React.ReactNode;
};

// Wraps toolbar children in the navigation alignment container.
const toolbar = (props: ToolbarProps) => <div className="toolbar">{props.children}</div>;

export default toolbar;
