import { keepAcrossHmr } from './hmr';

/**
 * What an error toast's copy button puts on the clipboard: the message, the error
 * behind it and where the toast was raised, as text to paste to Claude.
 */

interface LoggedError {
  at: number;
  text: string;
  stack?: string;
}

/** Everything the copy button needs that is gone by the time someone clicks it. */
export interface ErrorContext {
  path: string;
  at: number;
  /** The error behind the toast: the one handed to it, or one logged just before. */
  cause: LoggedError | null;
  /** Where the toast was raised. */
  raisedAt?: string;
}

/** An error logged this long before a toast is taken to be its cause. */
const RECENT_MS = 10_000;
/** Frames inside the toast plumbing say nothing about the error. */
const PLUMBING = /error-report\.ts|use-toast\.ts|components\/ui\/sonner\.tsx/;

const isErrorLike = (value: unknown): value is { stack?: string } =>
  value instanceof Error || (typeof value === 'object' && value !== null && typeof (value as { stack?: unknown }).stack === 'string');

function describe(value: unknown): string {
  if (value instanceof Error) return `${value.name}: ${value.message}`;
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value)?.slice(0, 500) ?? String(value);
  } catch {
    return String(value);
  }
}

const entry = (args: unknown[]): LoggedError => ({
  at: Date.now(),
  text: args.map(describe).join(' '),
  stack: args.find(isErrorLike)?.stack,
});

// Most code toasts a sentence and console.errors the Error itself, so the stack is
// rarely in the toast. Keep the last error logged so a toast raised after it can
// carry it. vite.config.ts ignore-lists this file, so DevTools still shows each
// console.error at its caller.
const log = keepAcrossHmr(import.meta.hot, 'errorLog', () => {
  const state: { last: LoggedError | null } = { last: null };
  const consoleError = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    // Only real errors: React's warnings arrive as plain strings.
    if (args.some(isErrorLike)) state.last = entry(args);
    consoleError(...args);
  };
  window.addEventListener('error', (e) => {
    state.last = entry([e.error ?? e.message]);
  });
  window.addEventListener('unhandledrejection', (e) => {
    state.last = entry(['Unhandled rejection:', e.reason]);
  });
  return state;
});

/** Takes down what the copy button will need, at the moment the toast is raised. */
export function captureErrorContext(error?: unknown): ErrorContext {
  const now = Date.now();
  const recent = log.last && now - log.last.at <= RECENT_MS ? log.last : null;
  return {
    path: window.location.pathname + window.location.search,
    at: now,
    cause: error === undefined ? recent : entry([error]),
    raisedAt: new Error().stack,
  };
}

/** The app's own frames, without the dev server's origin or cache-busting queries. */
function frames(stack: string | undefined): string[] {
  const all = (stack ?? '').split('\n').filter((line) => /:\d+:\d+\)?\s*$/.test(line) && !PLUMBING.test(line));
  const own = all.filter((line) => !line.includes('/node_modules/'));
  const lines = own.map((line) => `    ${line.trim().split(`${window.location.origin}/`).join('').replace(/\?[tv]=\w+/g, '')}`);
  const skipped = all.length - own.length;
  if (skipped) lines.push(`    (${skipped === 1 ? 'one frame' : `${skipped} frames`} in libraries left out)`);
  return lines;
}

export function errorReport(message: string, context: ErrorContext): string {
  const { cause } = context;
  const lines = [
    'Error in Tome. Find the cause and fix it.',
    '',
    message || '(The toast had no text.)',
    '',
    `Page: ${context.path}`,
    `When: ${new Date(context.at).toISOString()}`,
  ];
  if (cause) {
    const before = Math.round((context.at - cause.at) / 100) / 10;
    lines.push('', before > 0 ? `Error logged ${before}s before the toast:` : 'Error:', cause.text, ...frames(cause.stack));
  } else {
    lines.push('', 'No error was logged with this toast.');
  }
  const raised = frames(context.raisedAt);
  if (raised.length) lines.push('', 'Toast raised at:', ...raised);
  return lines.join('\n');
}
