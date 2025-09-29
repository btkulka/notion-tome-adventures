import React from 'react';

interface FloatingProgressBarProps {
  isVisible: boolean;
  progress: number;
  statusText: string;
}

export const FloatingProgressBar: React.FC<FloatingProgressBarProps> = ({
  isVisible,
  progress,
  statusText
}) => {
  if (!isVisible) return null;

  return (
    <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50 transition-all duration-300 ease-in-out w-1/2">
      <div className="bg-slate-900/80 backdrop-blur-md rounded-xl shadow-2xl p-4">
        {/* Status text */}
        <div className="text-sm font-medium text-slate-200 mb-2 text-center">
          {statusText}
        </div>
        
        {/* Progress bar container */}
        <div className="w-full bg-slate-700/50 rounded-full h-2 mb-2">
          <div 
            className="bg-gradient-to-r from-blue-500 to-purple-600 h-2 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>
        
        {/* Progress percentage */}
        <div className="text-xs text-slate-400 text-center">
          {Math.round(progress)}%
        </div>
      </div>
    </div>
  );
};
