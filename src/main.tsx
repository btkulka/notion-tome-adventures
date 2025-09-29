import React from 'react'
import { createRoot } from 'react-dom/client'
import TestSimple from './test-simple.tsx'

console.log('Main.tsx executing...');

const rootElement = document.getElementById("root");
console.log('Root element:', rootElement);
console.log('Root element innerHTML before:', rootElement?.innerHTML);

if (rootElement) {
  // Clear any existing content
  rootElement.innerHTML = '';
  
  const root = createRoot(rootElement);
  root.render(<TestSimple />);
  console.log('TestSimple rendered');
  
  // Check what was actually rendered
  setTimeout(() => {
    console.log('Root element innerHTML after:', rootElement.innerHTML);
    console.log('Document body style:', document.body.style.cssText);
  }, 200);
} else {
  console.error('Root element not found!');
}
