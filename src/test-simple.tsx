// Simple test component to check basic React rendering
import React, { useEffect } from 'react';

console.log('TestSimple component loading...');

export default function TestSimple() {
  console.log('TestSimple component rendering...');
  
  useEffect(() => {
    console.log('TestSimple useEffect running...');
    // Force some styling directly on body to debug
    document.body.style.backgroundColor = 'blue';
    document.body.style.color = 'white';
    
    // Also try to find our div and style it
    setTimeout(() => {
      const testDiv = document.querySelector('[data-testid="test-div"]');
      console.log('Found test div:', testDiv);
      if (testDiv) {
        (testDiv as HTMLElement).style.backgroundColor = 'green';
        (testDiv as HTMLElement).style.position = 'fixed';
        (testDiv as HTMLElement).style.top = '0';
        (testDiv as HTMLElement).style.left = '0';
        (testDiv as HTMLElement).style.width = '100vw';
        (testDiv as HTMLElement).style.height = '100vh';
        (testDiv as HTMLElement).style.zIndex = '99999';
      }
    }, 100);
  }, []);
  
  return (
    <div 
      data-testid="test-div"
      style={{ 
        padding: '20px', 
        color: 'yellow', 
        backgroundColor: 'red',
        fontSize: '24px',
        fontWeight: 'bold',
        position: 'fixed',
        top: '0px',
        left: '0px',
        zIndex: 999999,
        width: '100vw',
        height: '100vh',
        border: '5px solid black'
      }}
    >
      TEST COMPONENT VISIBLE! React working. Background should be red.
      <br />
      <br />
      Current time: {new Date().toLocaleTimeString()}
    </div>
  );
}