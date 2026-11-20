import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { NavCheckScreen } from './screens/NavCheckScreen';
import './theme/global.css';

// ?navcheck=1 opens the lane / toll dev check page instead of the app.
const showNavCheck = new URLSearchParams(location.search).has('navcheck');

createRoot(document.getElementById('root')!).render(
  <StrictMode>{showNavCheck ? <NavCheckScreen /> : <App />}</StrictMode>,
);
