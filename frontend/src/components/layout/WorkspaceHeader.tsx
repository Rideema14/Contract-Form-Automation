'use client';

import React from 'react';
import NextLink from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { Badge } from '@/components/ui/badge';
import { FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { logout } from '@/services/auth';
import { useRouter } from 'next/navigation';

export function WorkspaceHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { authUser } = useAuth();

  const navLinks = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Contracts', href: '/contracts' },
    { label: 'Approvals', href: '/approvals' },
    ...(authUser?.role === 'ADMIN'
      ? [
          { label: 'Users', href: '/admin/users' },
          { label: 'Reference data', href: '/admin/reference-data' },
        ]
      : []),
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-backdrop-filter:backdrop-blur">
      <div className="container mx-auto flex h-14 items-center justify-between px-4 sm:px-6">
        {/* Brand & Navigation */}
        <div className="flex items-center gap-6">
          <NextLink href="/dashboard" className="flex items-center gap-2 font-semibold text-sm">
            <div className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <FileText className="size-4" />
            </div>
            <span className="hidden sm:inline-block">Contract Forms Automation</span>
          </NextLink>

          <nav className="flex items-center gap-1 sm:gap-2">
            {navLinks.map((link) => {
              const isActive = pathname.startsWith(link.href);
              return (
                <NextLink
                  key={link.href}
                  href={link.href}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    isActive
                      ? 'bg-muted text-foreground'
                      : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                  }`}
                >
                  {link.label}
                </NextLink>
              );
            })}
          </nav>
        </div>

        {/* Right Action Icons & User */}
        <div className="flex items-center gap-3">
          <NotificationBell />

          {authUser && (
            <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-border text-xs">
              <div className="flex flex-col text-right">
                <span className="font-medium text-foreground leading-tight">{authUser.fullName}</span>
                <span className="text-[10px] text-muted-foreground">{authUser.email}</span>
              </div>
              <Badge variant="outline" className="text-[10px] uppercase font-mono px-1.5 py-0">
                {authUser.role}
              </Badge>
            </div>
          )}
          {authUser && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => void logout().then(() => router.replace('/login')).catch(() => undefined)}
            >
              Sign out
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
