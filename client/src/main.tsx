import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';

// Apply saved font size preference on load
const savedFontSize = localStorage.getItem('settings:fontSize');
if (savedFontSize) {
  document.documentElement.dataset.fontSize = savedFontSize;
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Failed to find the root element with ID "root"');
}

ReactDOM.createRoot(rootElement).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>,
);
