import React, { useEffect, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { errorReport, type ErrorContext } from '@/lib/error-report';

/** The visible text of the toast this button sits in: sonner marks it with data-title and data-description, the Toaster with data-toast-text. */
function toastText(button: HTMLElement): string {
  const parts = button.closest('li')?.querySelectorAll<HTMLElement>('[data-title], [data-description], [data-toast-text]') ?? [];
  return Array.from(parts, (el) => el.innerText.trim()).filter(Boolean).join('\n');
}

/** The copy icon on error toasts: copies the message and stack trace, ready to paste to Claude. */
export function CopyErrorButton({ context, className }: { context: ErrorContext; className?: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(timer);
  }, [copied]);

  const copy = (e: React.MouseEvent<HTMLButtonElement>) => {
    // Keeps sonner from dismissing the toast.
    e.preventDefault();
    navigator.clipboard
      .writeText(errorReport(toastText(e.currentTarget), context))
      .then(() => setCopied(true))
      .catch((err) => console.warn('Could not copy the error report:', err));
  };

  const label = copied ? 'Copied' : 'Copy the error and stack trace';
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={copy}
      className={cn('flex shrink-0 items-center justify-center rounded-md text-foreground/60 transition-colors hover:text-foreground', className)}
    >
      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
    </button>
  );
}
