'use client';

import React, { useState } from 'react';
import NextLink from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { FileText, Menu, X } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { logout } from '@/services/auth';

export function WorkspaceHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { authUser } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Contracts', href: '/contracts' },
    { label: authUser?.role === 'SUBMITTER' ? 'Status' : 'Approvals', href: '/approvals' },
    ...(authUser?.role === 'ADMIN'
      ? [
          { label: 'Users', href: '/admin/users' },
          { label: 'Reference data', href: '/admin/reference-data' },
          { label: 'Form builder', href: '/admin/form-builder' },
        ]
      : []),
  ];

  function signOut() {
    void logout().then(() => router.replace('/login')).catch(() => undefined);
  }

  function isActive(href: string) {
    return pathname.startsWith(href);
  }

  function desktopLinkClass(href: string) {
    return `whitespace-nowrap rounded-full px-3 py-2 text-sm font-medium transition-colors xl:text-base ${
      isActive(href)
        ? 'bg-primary/10 text-primary'
        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
    }`;
  }

  function mobileLinkClass(href: string) {
    return `flex min-h-11 items-center rounded-xl px-4 py-2 text-base font-medium transition-colors ${
      isActive(href)
        ? 'bg-primary/10 text-primary'
        : 'text-foreground hover:bg-muted'
    }`;
  }

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/90 shadow-sm backdrop-blur supports-backdrop-filter:backdrop-blur">
      <div className="container mx-auto max-w-7xl px-3 sm:px-6">
        <div className="flex h-16 items-center gap-3">
          <NextLink href="/dashboard" className="flex shrink-0 items-center gap-2.5 font-semibold">
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <FileText className="size-4" />
            </span>
            <span className="hidden text-sm sm:inline-block">Contract Forms Automation</span>
          </NextLink>

          <nav aria-label="Main navigation" className="hidden min-w-0 flex-1 items-center justify-center gap-1 xl:flex">
            {navLinks.map((link) => (
              <NextLink
                key={link.href}
                href={link.href}
                className={desktopLinkClass(link.href)}
                aria-current={isActive(link.href) ? 'page' : undefined}
              >
                {link.label}
              </NextLink>
            ))}
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
            <NotificationBell />

            {authUser && (
              <div className="flex min-w-0 items-center gap-2 rounded-full border border-border/70 bg-background px-2 py-1">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                  {authUser.fullName.slice(0, 1).toUpperCase()}
                </div>
                <div className="hidden min-w-0 flex-col sm:flex">
                  <span className="max-w-28 truncate text-xs font-semibold text-foreground">{authUser.fullName}</span>
                  <span className="hidden max-w-40 truncate text-[10px] text-muted-foreground 2xl:block">{authUser.email}</span>
                </div>
                <Badge variant="outline" className="shrink-0 px-1.5 py-0 font-mono text-[10px] uppercase">
                  {authUser.role}
                </Badge>
              </div>
            )}

            {authUser && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="hidden md:inline-flex"
                onClick={signOut}
              >
                Sign out
              </Button>
            )}

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="xl:hidden"
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-primary-navigation"
              onClick={() => setMobileMenuOpen((open) => !open)}
            >
              {mobileMenuOpen ? <X /> : <Menu />}
              <span>{mobileMenuOpen ? 'Close' : 'Menu'}</span>
            </Button>
          </div>
        </div>

        <nav
          id="mobile-primary-navigation"
          aria-label="Main navigation"
          className={mobileMenuOpen ? 'grid gap-1 border-t py-2 xl:hidden' : 'hidden xl:hidden'}
        >
          {navLinks.map((link) => (
            <NextLink
              key={link.href}
              href={link.href}
              className={mobileLinkClass(link.href)}
              aria-current={isActive(link.href) ? 'page' : undefined}
              onClick={() => setMobileMenuOpen(false)}
            >
              {link.label}
            </NextLink>
          ))}
          {authUser && (
            <Button type="button" variant="ghost" className="mt-1 w-full justify-start md:hidden" onClick={signOut}>
              Sign out
            </Button>
          )}
        </nav>
      </div>
    </header>
  );
}
