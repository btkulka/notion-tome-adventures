import { useEffect, useRef } from 'react';

export const PerformanceMonitor = () => {
  const renderCount = useRef(0);
  const lastRender = useRef(Date.now());

  useEffect(() => {
    renderCount.current++;
    const now = Date.now();
    const timeSinceLastRender = now - lastRender.current;
    
    // Warn about excessive re-renders
    if (timeSinceLastRender < 100 && renderCount.current > 10) {
      console.warn('⚠️ EXCESSIVE RE-RENDERS DETECTED', {
        renderCount: renderCount.current,
        timeSinceLastRender,
        possibleCause: 'Infinite loop or state thrashing'
      });
    }

    lastRender.current = now;

    // Memory usage check (Chrome only)
    if ('memory' in performance) {
      const mem = (performance as any).memory;
      const memoryUsage = (mem.usedJSHeapSize / 1048576).toFixed(2);
      if (parseFloat(memoryUsage) > 100) {
        console.warn('⚠️ HIGH MEMORY USAGE', {
          usedMB: memoryUsage,
          totalMB: (mem.totalJSHeapSize / 1048576).toFixed(2)
        });
      }
    }
  });

  return null;
};
