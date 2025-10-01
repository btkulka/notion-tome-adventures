import React from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { AlertCircle, ChevronDown, RefreshCw, Copy } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface EdgeFunctionErrorProps {
  error: Error | string;
  operationName: string;
  onRetry?: () => void;
  className?: string;
}

export const EdgeFunctionError: React.FC<EdgeFunctionErrorProps> = ({
  error,
  operationName,
  onRetry,
  className
}) => {
  const [isExpanded, setIsExpanded] = React.useState(false);
  const { toast } = useToast();

  const errorMessage = typeof error === 'string' ? error : error.message;
  const errorStack = typeof error === 'object' && error instanceof Error ? error.stack : undefined;

  const handleCopyError = () => {
    const errorDetails = `
Operation: ${operationName}
Error: ${errorMessage}
${errorStack ? `\nStack Trace:\n${errorStack}` : ''}
Timestamp: ${new Date().toISOString()}
    `.trim();

    navigator.clipboard.writeText(errorDetails);
    toast({
      title: "Error copied",
      description: "Error details copied to clipboard",
    });
  };

  return (
    <Alert variant="destructive" className={className}>
      <AlertCircle className="h-4 w-4" />
      <AlertTitle className="flex items-center justify-between">
        <span>Edge Function Error: {operationName}</span>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopyError}
            className="h-6 px-2"
          >
            <Copy className="h-3 w-3" />
          </Button>
          {onRetry && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onRetry}
              className="h-6 px-2"
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Retry
            </Button>
          )}
        </div>
      </AlertTitle>
      <AlertDescription className="space-y-2">
        <p className="text-sm">{errorMessage}</p>
        
        {errorStack && (
          <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
            <CollapsibleTrigger className="flex items-center gap-2 text-xs hover:underline">
              <ChevronDown className={`h-3 w-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
              {isExpanded ? 'Hide' : 'Show'} Stack Trace
            </CollapsibleTrigger>
            <CollapsibleContent>
              <pre className="mt-2 p-2 bg-background/50 rounded text-xs overflow-x-auto whitespace-pre-wrap break-all">
                {errorStack}
              </pre>
            </CollapsibleContent>
          </Collapsible>
        )}
      </AlertDescription>
    </Alert>
  );
};
