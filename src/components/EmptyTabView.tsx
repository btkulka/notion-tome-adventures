import React from 'react';
import { Dice6 } from 'lucide-react';

export function EmptyTabView() {
  return (
    <div className="text-center py-16">
      <Dice6 className="mx-auto h-16 w-16 text-muted-foreground mb-6" />
      <p className="text-muted-foreground mb-4">
        No content generated yet.
      </p>
      <p className="text-sm text-muted-foreground">
        Configure your parameters in the sidebar and generate encounters or magic items!
      </p>
    </div>
  );
}
