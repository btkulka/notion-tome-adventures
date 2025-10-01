import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronDown, Copy } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface ErrorToastContentProps {
  title: string;
  message: string;
  error?: Error;
}

export const ErrorToastContent: React.FC<ErrorToastContentProps> = ({
  title,
  message,
  error
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleCopy = () => {
    const fullError = `
${title}
${message}

${error?.stack || 'No stack trace available'}

Timestamp: ${new Date().toISOString()}
    `.trim();

    navigator.clipboard.writeText(fullError);
    toast({
      title: "Copied!",
      description: "Error details copied to clipboard",
    });
  };

  return (
    <div className="space-y-2">
      <p className="text-sm">{message}</p>
      
      {error?.stack && (
        <div className="flex items-center gap-2 pt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="h-7 px-2 text-xs"
          >
            <ChevronDown className={`h-3 w-3 mr-1 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
            {isExpanded ? 'Hide' : 'Show'} Stack Trace
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            className="h-7 px-2 text-xs"
          >
            <Copy className="h-3 w-3 mr-1" />
            Copy All
          </Button>
        </div>
      )}
      
      {isExpanded && error?.stack && (
        <pre className="mt-2 p-2 bg-background/50 rounded text-xs overflow-x-auto whitespace-pre-wrap break-all max-h-48 overflow-y-auto">
          {error.stack}
        </pre>
      )}
    </div>
  );
};
