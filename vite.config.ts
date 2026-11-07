import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 1974,
    hmr: {
      overlay: true,
      clientPort: 1974,
      timeout: 30000, // Increase timeout
    },
    // The Worker (npm run dev:api) serves the API, Discord sign-in and the live-table socket.
    proxy: {
      '/api': { target: 'http://127.0.0.1:8787', ws: true },
      '/auth': { target: 'http://127.0.0.1:8787' },
    },
    // error-report.ts wraps console.error; ignore-listing it keeps DevTools pointing each log at its caller.
    sourcemapIgnoreList: (sourcePath) => sourcePath.includes('node_modules') || sourcePath.endsWith('error-report.ts'),
    watch: {
      usePolling: false,
      // The Notion export and its web copies are thousands of files written in bursts; neither is source.
      ignored: ['**/node_modules/**', '**/.git/**', '**/.notion-export/**', '**/public/notion-files/**', '**/.wrangler/**'],
    },
  },
  build: {
    sourcemap: true,
    rollupOptions: {
      onwarn(warning, warn) {
        // Log circular dependencies
        if (warning.code === 'CIRCULAR_DEPENDENCY') {
          console.error('Circular dependency:', warning.message);
        }
        warn(warning);
      }
    }
  },
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  optimizeDeps: {
    exclude: [],
  },
}));
