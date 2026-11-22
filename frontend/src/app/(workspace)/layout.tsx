import React from 'react';
import { WorkspaceHeader } from '@/components/layout/WorkspaceHeader';

export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <WorkspaceHeader />
      <div className="flex-1">
        {children}
      </div>
    </div>
  );
}
