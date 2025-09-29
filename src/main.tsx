import { createRoot } from 'react-dom/client'
import './index.css'

console.log('Main.tsx loaded - basic test');

// Simple test component
function TestApp() {
  return <div style={{color: 'red', fontSize: '24px', padding: '20px'}}>Test App Loading</div>;
}

try {
  const root = document.getElementById("root");
  console.log('Root element found:', root);
  
  if (root) {
    createRoot(root).render(<TestApp />);
    console.log('Test app rendered successfully');
  } else {
    console.error('Root element not found');
  }
} catch (error) {
  console.error('Error rendering app:', error);
}
