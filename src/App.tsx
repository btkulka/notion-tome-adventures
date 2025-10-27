import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { ErrorBoundary } from "react-error-boundary";
import React, { useState, Suspense, lazy } from "react";
import { PerformanceMonitor } from "@/debug/PerformanceMonitor";

const Index = lazy(() => import("./pages/Index"));

function ErrorFallback({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
      <div className="text-center p-8 max-w-md">
        <h1 className="text-2xl font-bold mb-4 text-red-400">Something went wrong</h1>
        <details className="mb-4 text-left">
          <summary className="cursor-pointer text-yellow-400 hover:text-yellow-300">Error Details:</summary>
          <pre className="mt-2 p-4 bg-gray-800 rounded text-sm overflow-auto text-red-300">
            {error.name}: {error.message}
            {error.stack}
          </pre>
        </details>
        <button 
          onClick={resetErrorBoundary}
          className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
        >
          Try again
        </button>
      </div>
    </div>
  );
}

function LoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
}

const App = () => {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        retry: 1,
        refetchOnWindowFocus: false,
        staleTime: 5 * 60 * 1000,
      },
    },
  }));

  try {
    return (
      <ErrorBoundary 
        FallbackComponent={ErrorFallback}
        onReset={() => window.location.reload()}
        onError={(error) => {
          console.error('App-level error:', error);
        }}
      >
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <PerformanceMonitor />
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Suspense fallback={<LoadingFallback />}>
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="*" element={
                    <div className="min-h-screen flex items-center justify-center bg-background">
                      <div className="text-center">
                        <h1 className="text-2xl font-bold mb-2">404 - Page Not Found</h1>
                        <p className="text-muted-foreground">The requested page does not exist.</p>
                      </div>
                    </div>
                  } />
                </Routes>
              </Suspense>
            </BrowserRouter>
          </TooltipProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    );
  } catch (error) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h1 style={{ color: 'red' }}>Critical App Error</h1>
        <p>{error instanceof Error ? error.message : 'Unknown error'}</p>
        <button onClick={() => window.location.reload()}>Reload</button>
      </div>
    );
  }
};

export default App;
