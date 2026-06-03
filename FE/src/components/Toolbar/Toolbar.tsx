// Simple container for aligning the main navigation content.
import React from 'react';

import './Toolbar.css';

// Wraps toolbar children in the navigation alignment container.
const toolbar = props => (
    <div className="toolbar">
       {props.children}
    </div>
);

export default toolbar;
