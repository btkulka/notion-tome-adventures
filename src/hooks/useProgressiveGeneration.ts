import { useState, useCallback, useRef, useEffect } from 'react';

export interface ProgressStep {
  id: string;
  label: string;
  targetProgress: number;
  isCompleted: boolean;
  timestamp?: number;
}

export interface ProgressState {
  currentProgress: number;
  currentStatus: string;
  steps: ProgressStep[];
  isActive: boolean;
  logs: string[];
}

// Define the major steps that align with the edge function
const GENERATION_STEPS: Omit<ProgressStep, 'isCompleted' | 'timestamp'>[] = [
  { id: 'init', label: 'Initializing generation...', targetProgress: 5 },
  { id: 'notion-connect', label: 'Connecting to Notion databases...', targetProgress: 15 },
  { id: 'validate-dbs', label: 'Validating database connections...', targetProgress: 25 },
  { id: 'fetch-creatures', label: 'Fetching creatures catalog...', targetProgress: 45 },
  { id: 'resolve-relations', label: 'Resolving creature relationships...', targetProgress: 65 },
  { id: 'process-creatures', label: 'Processing creature data...', targetProgress: 80 },
  { id: 'generate-encounter', label: 'Generating balanced encounter...', targetProgress: 95 },
  { id: 'complete', label: 'Generation complete!', targetProgress: 100 }
];

export const useProgressiveGeneration = () => {
  const [progressState, setProgressState] = useState<ProgressState>({
    currentProgress: 0,
    currentStatus: '',
    steps: GENERATION_STEPS.map(step => ({ ...step, isCompleted: false })),
    isActive: false,
    logs: []
  });

  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const currentStepIndexRef = useRef<number>(0);
  const targetProgressRef = useRef<number>(0);

  // Smooth animation between progress points
  const animateProgress = useCallback((targetProgress: number, duration: number = 1500) => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }

    const steps = 60; // 60 FPS-like updates
    const stepDuration = duration / steps;
    let currentStep = 0;

    // Use functional state updates to avoid stale closures
    progressIntervalRef.current = setInterval(() => {
      currentStep++;
      
      setProgressState(prev => {
        const startProgress = prev.currentProgress;
        const progressDiff = targetProgress - startProgress;
        const progressStep = progressDiff / steps;
        const newProgress = Math.min(
          startProgress + (progressStep * currentStep),
          targetProgress
        );

        // Stop interval if complete
        if (currentStep >= steps || newProgress >= targetProgress) {
          if (progressIntervalRef.current) {
            clearInterval(progressIntervalRef.current);
            progressIntervalRef.current = null;
          }
        }

        return {
          ...prev,
          currentProgress: newProgress
        };
      });
    }, stepDuration);
  }, []); // No dependencies - uses functional updates

  // Add subtle pseudo-loading between major steps
  const addPseudoLoading = useCallback((baseProgress: number, range: number = 3) => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }

    const maxProgress = Math.min(baseProgress + range, 100);
    let direction = 1;

    // Use functional state updates to avoid stale closures
    progressIntervalRef.current = setInterval(() => {
      setProgressState(prev => {
        let currentProg = prev.currentProgress + (direction * 0.2);
        
        if (currentProg >= maxProgress) {
          currentProg = maxProgress;
          direction = -1;
        } else if (currentProg <= baseProgress) {
          currentProg = baseProgress;
          direction = 1;
        }

        return {
          ...prev,
          currentProgress: currentProg
        };
      });
    }, 100);
  }, []); // No dependencies - uses functional updates

  const startGeneration = useCallback(() => {
    currentStepIndexRef.current = 0;
    setProgressState({
      currentProgress: 0,
      currentStatus: GENERATION_STEPS[0].label,
      steps: GENERATION_STEPS.map(step => ({ ...step, isCompleted: false, timestamp: undefined })),
      isActive: true,
      logs: [`[${new Date().toLocaleTimeString()}] ${GENERATION_STEPS[0].label}`]
    });
  }, []);

  const markStepComplete = useCallback((stepId: string) => {
    const stepIndex = GENERATION_STEPS.findIndex(step => step.id === stepId);
    if (stepIndex === -1) return;

    const step = GENERATION_STEPS[stepIndex];
    
    setProgressState(prev => ({
      ...prev,
      currentStatus: step.label,
      steps: prev.steps.map((s, index) => 
        index === stepIndex 
          ? { ...s, isCompleted: true, timestamp: Date.now() }
          : s
      ),
      logs: [...prev.logs, `[${new Date().toLocaleTimeString()}] ${step.label}`]
    }));

    // Animate to this step's target progress
    animateProgress(step.targetProgress, 800);

    // If not the last step, start pseudo-loading for the next step
    if (stepIndex < GENERATION_STEPS.length - 1) {
      setTimeout(() => {
        const nextStep = GENERATION_STEPS[stepIndex + 1];
        setProgressState(prev => ({
          ...prev,
          currentStatus: nextStep.label
        }));
        
        // Add subtle pseudo-loading until next real step
        addPseudoLoading(step.targetProgress, Math.min(5, nextStep.targetProgress - step.targetProgress - 2));
      }, 1000);
    }

    currentStepIndexRef.current = stepIndex + 1;
  }, [animateProgress, addPseudoLoading]);

  const completeGeneration = useCallback(() => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }

    setProgressState(prev => ({
      ...prev,
      currentProgress: 100,
      currentStatus: 'Generation complete!',
      steps: prev.steps.map(step => ({ ...step, isCompleted: true })),
      isActive: false,
      logs: [...prev.logs, `[${new Date().toLocaleTimeString()}] Generation complete!`]
    }));
  }, []);

  const cancelGeneration = useCallback(() => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }

    setProgressState(prev => ({
      ...prev,
      currentStatus: 'Generation cancelled',
      isActive: false
    }));
  }, []);

  const resetProgress = useCallback(() => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }

    setProgressState({
      currentProgress: 0,
      currentStatus: '',
      steps: GENERATION_STEPS.map(step => ({ ...step, isCompleted: false })),
      isActive: false,
      logs: []
    });
    currentStepIndexRef.current = 0;
  }, []);

  // Cleanup on unmount and HMR
  useEffect(() => {
    console.log('🎯 useProgressiveGeneration mounted');
    
    return () => {
      console.log('🧹 useProgressiveGeneration cleanup - clearing intervals');
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
    };
  }, []);

  return {
    progressState,
    startGeneration,
    markStepComplete,
    completeGeneration,
    cancelGeneration,
    resetProgress,
    // Convenience getters
    currentProgress: progressState.currentProgress,
    currentStatus: progressState.currentStatus,
    logs: progressState.logs,
    isActive: progressState.isActive
  };
};
