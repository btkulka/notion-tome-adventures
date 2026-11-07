import { BrowserRouter, Navigate, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { ErrorBoundary } from "react-error-boundary";
import React, { Suspense, lazy, useState } from "react";
import { PerformanceMonitor } from "@/debug/PerformanceMonitor";
import { AuthProvider } from "@/features/auth/AuthProvider";
import { FullScreenSpinner, Notice, RequireAuth, RequireDm } from "@/features/auth/guards";
import { keepAcrossHmr } from "@/lib/hmr";

// Outlives App so an edit that remounts it doesn't throw away every cached query.
const queryClient = keepAcrossHmr(import.meta.hot, "queryClient", () => new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000,
    },
  },
}));

/**
 * A route in its own chunk that can be fetched ahead of time. Once the chunk has
 * arrived the route renders straight away; only a route that is still loading
 * suspends (and router transitions keep the old screen up meanwhile).
 */
function lazyRoute(load: () => Promise<{ default: React.ComponentType }>) {
  let loaded: React.ComponentType | null = null;
  let pending: Promise<unknown> | null = null;
  const preload = () =>
    (pending ??= load().then(
      (m) => {
        loaded = m.default;
      },
      (err) => {
        pending = null;
        throw err;
      }
    ));
  const Lazy = lazy(() => preload().then(() => ({ default: loaded! })));
  // Picked once per mount: swapping Lazy for the loaded component later would remount the page.
  const Screen = () => {
    const [Page] = useState(() => loaded ?? Lazy);
    return <Page />;
  };
  return Object.assign(Screen, { preload });
}

const Index = lazyRoute(() => import("./pages/Index"));
const LoginPage = lazyRoute(() => import("@/features/auth/LoginPage"));
const JoinPage = lazyRoute(() => import("@/features/auth/JoinPage"));
const HomeRedirect = lazyRoute(() => import("@/features/suite/HomeRedirect"));
const SuiteShell = lazyRoute(() => import("@/features/suite/SuiteShell"));
const MapLibraryPage = lazyRoute(() => import("@/features/maps/MapLibraryPage"));
const MapEditorPage = lazyRoute(() => import("@/features/maps/MapEditorPage"));
const DmTablePage = lazyRoute(() => import("@/features/table/DmTablePage"));
const PlayerPage = lazyRoute(() => import("@/features/table/PlayerPage"));
const CharactersPage = lazyRoute(() => import("@/features/characters/CharactersPage"));
const CampaignPage = lazyRoute(() => import("@/features/suite/CampaignPage"));
const SettingsPage = lazyRoute(() => import("@/features/settings/SettingsPage"));
const DatabasePage = lazyRoute(() => import("@/features/database/DatabasePage"));
const TreasurePage = lazyRoute(() => import("@/features/tools/TreasurePage"));

/** What the first screen at a path needs, fetched while the session check is out. */
function firstScreen(path: string) {
  if (path === "/login") return [LoginPage];
  if (path.startsWith("/join/")) return [JoinPage];
  if (path.startsWith("/play/")) return path.endsWith("/characters") ? [CharactersPage] : [PlayerPage];
  const suite: [string, { preload: () => Promise<unknown> }][] = [
    ["/table", DmTablePage],
    ["/tools/encounters", Index],
    ["/generate", Index],
    ["/tools/treasure", TreasurePage],
    ["/maps/", MapEditorPage],
    ["/maps", MapLibraryPage],
    ["/database", DatabasePage],
    ["/campaign", CampaignPage],
    ["/settings", SettingsPage],
  ];
  const page = suite.find(([prefix]) => path.startsWith(prefix))?.[1];
  // "/" sends a DM to the table, the likelier of the two.
  return path === "/" ? [HomeRedirect, SuiteShell, DmTablePage] : [SuiteShell, ...(page ? [page] : [])];
}

const ALL_ROUTES = [
  Index, LoginPage, JoinPage, HomeRedirect, SuiteShell, MapLibraryPage, MapEditorPage, DmTablePage,
  PlayerPage, CharactersPage, CampaignPage, SettingsPage, DatabasePage, TreasurePage,
];

const ignore = () => undefined;
for (const route of firstScreen(window.location.pathname)) route.preload().catch(ignore);
// Then everything else, so switching tools never waits on a chunk.
window.addEventListener("load", () => {
  const later = () => ALL_ROUTES.forEach((route) => route.preload().catch(ignore));
  if ("requestIdleCallback" in window) window.requestIdleCallback(later, { timeout: 4000 });
  else setTimeout(later, 1500);
}, { once: true });

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
  return <FullScreenSpinner />;
}

const App = () => {
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
            <BrowserRouter future={{ v7_startTransition: true }}>
              <AuthProvider>
              <Suspense fallback={<LoadingFallback />}>
                <Routes>
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/join/:code" element={<RequireAuth><JoinPage /></RequireAuth>} />
                  <Route path="/" element={<RequireAuth><HomeRedirect /></RequireAuth>} />
                  <Route path="/play/:campaignId" element={<RequireAuth><PlayerPage /></RequireAuth>} />
                  <Route path="/play/:campaignId/characters" element={<RequireAuth><CharactersPage /></RequireAuth>} />
                  <Route element={<RequireDm><SuiteShell /></RequireDm>}>
                    <Route path="/table" element={<DmTablePage />} />
                    <Route path="/tools/encounters" element={<Index />} />
                    <Route path="/tools/treasure" element={<TreasurePage />} />
                    <Route path="/generate" element={<Navigate to="/tools/encounters" replace />} />
                    <Route path="/maps" element={<MapLibraryPage />} />
                    <Route path="/maps/:mapId" element={<MapEditorPage />} />
                    <Route path="/database" element={<DatabasePage />} />
                    <Route path="/database/:tableKey" element={<DatabasePage />} />
                    <Route path="/campaign" element={<CampaignPage />} />
                    <Route path="/settings" element={<SettingsPage />} />
                  </Route>
                  <Route path="*" element={
                    <Notice title="Nothing here" action={<a href="/" className="t-btn self-start">Back to the table</a>}>
                      <p className="m-0">This page isn't in the tome.</p>
                    </Notice>
                  } />
                </Routes>
              </Suspense>
              </AuthProvider>
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
