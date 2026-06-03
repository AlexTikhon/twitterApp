// Mounts the React app with routing enabled for the auth and feed pages.
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import './index.css';
import App from './App';

const rootElement = document.getElementById('root');

if (!rootElement) {
	throw new Error('Root element not found.');
}

createRoot(rootElement).render(
	<BrowserRouter>
		<App />
	</BrowserRouter>
);
