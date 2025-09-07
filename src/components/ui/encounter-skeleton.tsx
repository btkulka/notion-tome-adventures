import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export function CreatureCardSkeleton() {
  return (
    <Card className="bg-gradient-to-br from-card to-muted/20 border-border/50 shadow-lg">
      {/* Image skeleton */}
      <Skeleton className="h-48 w-full rounded-t-lg" />
      
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Name and instance info */}
          <div>
            <Skeleton className="h-6 w-3/4 mb-2" />
            <Skeleton className="h-4 w-1/2" />
          </div>
          
          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Skeleton className="h-3 w-12" />
                <Skeleton className="h-3 w-8" />
              </div>
              <div className="flex justify-between items-center">
                <Skeleton className="h-3 w-10" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Skeleton className="h-3 w-10" />
                <Skeleton className="h-3 w-14" />
              </div>
              <div className="flex justify-between items-center">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-3 w-12" />
              </div>
            </div>
          </div>
          
          {/* XP contribution */}
          <div className="pt-2 border-t border-border/50">
            <div className="flex justify-between items-center">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function EncounterSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header badges */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-24 rounded-full" />
        <div className="flex gap-2">
          <Skeleton className="h-8 w-20 rounded-full" />
        </div>
      </div>

      {/* Monsters section */}
      <div className="space-y-6">
        <Skeleton className="h-7 w-32" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }, (_, i) => (
            <CreatureCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
