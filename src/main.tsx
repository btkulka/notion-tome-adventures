import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { logger } from '@/utils/logger'

// Track startup timing
const startupTimestamp = performance.now();

logger.info('Application bootstrap started');

// Validate critical environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  logger.warn('Supabase configuration incomplete');
}

const rootElement = document.getElementById("root");

if (rootElement) {
  logger.info('Root element found, initializing React...');
  
  try {
    // Remove initial loader
    const initialLoader = document.getElementById('initial-loader');
    if (initialLoader) {
      initialLoader.style.display = 'none';
    }
    
    const root = createRoot(rootElement);
    root.render(<App />);
    
    const bootTime = (performance.now() - startupTimestamp).toFixed(2);
    logger.info(`React render complete (${bootTime}ms)`);
    
    // HMR event handlers for debugging
    if (import.meta.hot) {
      import.meta.hot.on('vite:beforeUpdate', () => {
        logger.info('🔄 HMR: Preparing to update...');
      });
      
      import.meta.hot.on('vite:afterUpdate', () => {
        logger.info('✅ HMR: Update complete');
      });
      
      import.meta.hot.on('vite:error', (error) => {
        logger.error('❌ HMR: Error during update', error);
      });
    }
  } catch (error) {
    logger.error('Fatal error during React initialization', error);
    
    // Display user-friendly error
    rootElement.innerHTML = `
      <div style="display: flex; align-items: center; justify-center; min-height: 100vh; background: #1a1a1a; color: #fff; font-family: system-ui;">
        <div style="text-align: center; padding: 2rem; max-width: 600px;">
          <h1 style="color: #ef4444; margin-bottom: 1rem;">Application Failed to Start</h1>
          <p style="color: #9ca3af; margin-bottom: 1rem;">
            The application encountered a critical error during initialization.
          </p>
          <details style="text-align: left; background: #262626; padding: 1rem; border-radius: 0.5rem; margin-top: 1rem;">
            <summary style="cursor: pointer; color: #fbbf24;">Technical Details</summary>
            <pre style="margin-top: 0.5rem; color: #ef4444; overflow: auto; font-size: 0.875rem;">${error instanceof Error ? error.message : String(error)}</pre>
          </details>
          <button onclick="location.reload()" style="margin-top: 1rem; padding: 0.5rem 1rem; background: #3b82f6; color: white; border: none; border-radius: 0.5rem; cursor: pointer;">
            Reload Page
          </button>
        </div>
      </div>
    `;
  }
} else {
  logger.error('CRITICAL: Root element not found in DOM!');
  
  // Fallback error display
  document.body.innerHTML = `
    <div style="display: flex; align-items: center; justify-center; min-height: 100vh; background: #1a1a1a; color: #fff; font-family: system-ui;">
      <div style="text-align: center; padding: 2rem;">
        <h1 style="color: #ef4444;">Critical Setup Error</h1>
        <p style="color: #9ca3af; margin-top: 1rem;">Root element (#root) not found in HTML.</p>
      </div>
    </div>
  `;
}