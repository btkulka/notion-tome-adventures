/**
 * Returns the value this module made before its last hot update, or makes it now.
 *
 * Vite re-runs a module when it (or a module it imports) is edited, which makes a
 * fresh copy of anything created at module level. For a React context that is
 * fatal: a provider and its consumers can end up holding different copies, and
 * every useX() throws until the page is reloaded. Pass the calling module's
 * `import.meta.hot`; in a production build it is undefined and this is `make()`.
 */
export function keepAcrossHmr<T>(hot: ImportMeta['hot'], key: string, make: () => T): T {
  if (!hot) return make();
  if (!(key in hot.data)) hot.data[key] = make();
  return hot.data[key] as T;
}
