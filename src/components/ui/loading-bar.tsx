import React, { useState, useEffect } from 'react';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface LoadingBarProps {
  isLoading: boolean;
  realProgress?: number;
  className?: string;
  showPercentage?: boolean;
  stages?: string[];
}

export function LoadingBar({ 
  isLoading, 
  realProgress, 
  className, 
  showPercentage = true,
  stages = [
    "Connecting to Notion...",
    "Fetching monster catalog...",
    "Resolving creature relationships...",
    "Processing monster data...",
    "Generating encounter...",
    "Finalizing results..."
  ]
}: LoadingBarProps) {
  const [pseudoProgress, setPseudoProgress] = useState(0);
  const [currentStage, setCurrentStage] = useState(0);

  useEffect(() => {
    if (!isLoading) {
      setPseudoProgress(0);
      setCurrentStage(0);
      return;
    }

    // If we have real progress, use it, otherwise use pseudo progress
    if (realProgress !== undefined) {
      setPseudoProgress(realProgress);
      // Update stage based on progress
      const stageIndex = Math.floor((realProgress / 100) * (stages.length - 1));
      setCurrentStage(Math.min(stageIndex, stages.length - 1));
      return;
    }

    // Pseudo progress simulation
    const intervals: NodeJS.Timeout[] = [];
    
    // Fast initial progress (0-20%)
    intervals.push(setInterval(() => {
      setPseudoProgress(prev => {
        if (prev < 20) return prev + Math.random() * 3 + 1;
        return prev;
      });
    }, 200));

    // Medium progress (20-60%)
    intervals.push(setInterval(() => {
      setPseudoProgress(prev => {
        if (prev >= 20 && prev < 60) return prev + Math.random() * 2 + 0.5;
        return prev;
      });
    }, 500));

    // Slow progress (60-90%)
    intervals.push(setInterval(() => {
      setPseudoProgress(prev => {
        if (prev >= 60 && prev < 90) return prev + Math.random() * 1 + 0.2;
        return prev;
      });
    }, 1000));

    // Stage progression
    const stageInterval = setInterval(() => {
      setCurrentStage(prev => {
        const nextStage = prev + 1;
        return nextStage < stages.length ? nextStage : prev;
      });
    }, 2000);

    intervals.push(stageInterval);

    return () => {
      intervals.forEach(interval => clearInterval(interval));
    };
  }, [isLoading, realProgress, stages.length]);

  // Complete when not loading
  useEffect(() => {
    if (!isLoading && pseudoProgress > 0) {
      setPseudoProgress(100);
      setCurrentStage(stages.length - 1);
      
      // Reset after animation
      const timeout = setTimeout(() => {
        setPseudoProgress(0);
        setCurrentStage(0);
      }, 500);
      
      return () => clearTimeout(timeout);
    }
  }, [isLoading, pseudoProgress, stages.length]);

  if (!isLoading && pseudoProgress === 0) return null;

  const displayProgress = realProgress !== undefined ? realProgress : pseudoProgress;

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">
          {stages[currentStage]}
        </span>
        {showPercentage && (
          <span className="text-sm text-muted-foreground">
            {Math.round(displayProgress)}%
          </span>
        )}
      </div>
      <Progress 
        value={displayProgress} 
        className="h-2 bg-muted/50"
      />
    </div>
  );
}
