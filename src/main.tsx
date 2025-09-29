import React from 'react'
import { createRoot } from 'react-dom/client'
import TestSimple from './test-simple.tsx'
// import './index.css'

console.log('Main.tsx executing...');
console.log('React:', React);
console.log('createRoot:', createRoot);

const rootElement = document.getElementById("root");
console.log('Root element:', rootElement);

if (rootElement) {
  createRoot(rootElement).render(<TestSimple />);
  console.log('TestSimple rendered');
} else {
  console.error('Root element not found!');
  document.body.innerHTML = '<div style="color: red; font-size: 24px;">ROOT ELEMENT NOT FOUND</div>';
}
