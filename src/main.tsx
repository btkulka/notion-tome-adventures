import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Debug iframe vs standalone loading
console.log('Loading context:', {
  isInIframe: window !== window.parent,
  userAgent: navigator.userAgent,
  location: window.location.href,
  timestamp: new Date().toISOString()
});

const rootElement = document.getElementById("root");

if (rootElement) {
  const root = createRoot(rootElement);
  root.render(<App />);
  console.log('App rendered successfully');
} else {
  console.error('Root element not found!');
}
