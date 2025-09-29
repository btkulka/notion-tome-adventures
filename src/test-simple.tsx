// Simple test component to check basic React rendering
import React from 'react';

console.log('TestSimple component loading...');

export default function TestSimple() {
  console.log('TestSimple component rendering...');
  
  return (
    <div style={{ 
      padding: '20px', 
      color: 'white', 
      backgroundColor: 'red',
      fontSize: '24px',
      fontWeight: 'bold',
      position: 'fixed',
      top: 0,
      left: 0,
      zIndex: 9999,
      width: '100vw',
      height: '100vh'
    }}>
      Test Component Working! If you see this, React is working.
    </div>
  );
}