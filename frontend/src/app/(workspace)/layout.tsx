import React from 'react';
import { WorkspaceHeader } from '@/components/layout/WorkspaceHeader';

export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <WorkspaceHeader />
      <div className="min-w-0 lg:pl-64">
        {children}
      </div>
    </div>
  );
}
