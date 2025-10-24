import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { ErrorBoundary } from "react-error-boundary";
import React from "react";
import Index from "./pages/Index";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

function ErrorFallback({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
      <div className="text-center p-8 max-w-md">
        <h1 className="text-2xl font-bold mb-4 text-red-400">Something went wrong with Index component</h1>
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

const App = () => {
  try {
    return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={
              <ErrorBoundary 
                FallbackComponent={ErrorFallback}
                onReset={() => {
                  window.location.reload();
                }}
                onError={(_error, _errorInfo) => {
                  // Error boundary caught error - handled by fallback component
                }}
              >
                <Index />
              </ErrorBoundary>
            } />
            <Route path="*" element={
              <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="text-center">
                  <h1 className="text-2xl font-bold mb-2">404 - Page Not Found</h1>
                  <p className="text-muted-foreground">The requested page does not exist.</p>
                </div>
              </div>
            } />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
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
