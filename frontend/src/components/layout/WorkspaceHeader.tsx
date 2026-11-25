'use client';

import React, { useState } from 'react';
import NextLink from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { FileText, LogOut, Menu, X } from 'lucide-react';
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

  const primaryLinks = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Contracts', href: '/contracts' },
    { label: authUser?.role === 'SUBMITTER' ? 'Status' : 'Approvals', href: '/approvals' },
  ];

  const adminLinks =
    authUser?.role === 'ADMIN'
      ? [
          { label: 'Users', href: '/admin/users' },
          { label: 'Reference data', href: '/admin/reference-data' },
          { label: 'Form builder', href: '/admin/form-builder' },
          { label: 'Audit history', href: '/admin/audit' },
        ]
      : [];

  const allLinks = [...primaryLinks, ...adminLinks];

  function signOut() {
    void logout().then(() => router.replace('/login')).catch(() => undefined);
  }

  function isActive(href: string) {
    return pathname.startsWith(href);
  }

  function desktopLinkClass(href: string) {
    return `whitespace-nowrap rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors ${
      isActive(href)
        ? 'bg-primary text-primary-foreground shadow-xs'
        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
    }`;
  }

  function mobileLinkClass(href: string) {
    return `flex min-h-10 items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
      isActive(href)
        ? 'bg-primary text-primary-foreground'
        : 'text-foreground hover:bg-muted'
    }`;
  }

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur supports-backdrop-filter:backdrop-blur">
      <div className="mx-auto max-w-7xl px-3 sm:px-6">
        <div className="flex h-16 items-center gap-4">
          <NextLink href="/dashboard" className="flex shrink-0 items-center gap-2.5 font-semibold tracking-tight">
            <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <FileText className="size-4" />
            </span>
            <span className="hidden text-sm font-bold sm:inline-block">Contract Forms</span>
          </NextLink>

          <nav aria-label="Main navigation" className="hidden min-w-0 flex-1 items-center gap-1 lg:flex">
            {primaryLinks.map((link) => (
              <NextLink
                key={link.href}
                href={link.href}
                className={desktopLinkClass(link.href)}
                aria-current={isActive(link.href) ? 'page' : undefined}
              >
                {link.label}
              </NextLink>
            ))}

            {adminLinks.length > 0 && (
              <>
                <span aria-hidden="true" className="mx-2 h-5 w-px bg-border" />
                <span className="mr-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Admin
                </span>
                {adminLinks.map((link) => (
                  <NextLink
                    key={link.href}
                    href={link.href}
                    className={desktopLinkClass(link.href)}
                    aria-current={isActive(link.href) ? 'page' : undefined}
                  >
                    {link.label}
                  </NextLink>
                ))}
              </>
            )}
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-2">
            <NotificationBell />

            {authUser && (
              <div className="flex min-w-0 items-center gap-2 rounded-lg border border-border bg-muted/40 px-2.5 py-1">
                <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
                  {authUser.fullName.slice(0, 1).toUpperCase()}
                </div>
                <div className="hidden min-w-0 flex-col sm:flex">
                  <span className="max-w-28 truncate text-xs font-semibold leading-none text-foreground">
                    {authUser.fullName}
                  </span>
                  <span className="mt-0.5 hidden max-w-40 truncate text-[10px] leading-none text-muted-foreground 2xl:block">
                    {authUser.email}
                  </span>
                </div>
                <Badge variant="outline" className="shrink-0 bg-background px-1.5 py-0 font-mono text-[10px] uppercase">
                  {authUser.role}
                </Badge>
              </div>
            )}

            {authUser && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="hidden md:inline-flex"
                onClick={signOut}
              >
                <LogOut className="size-3.5" />
                Sign out
              </Button>
            )}

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="lg:hidden"
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-primary-navigation"
              onClick={() => setMobileMenuOpen((open) => !open)}
            >
              {mobileMenuOpen ? <X className="size-4" /> : <Menu className="size-4" />}
              <span>{mobileMenuOpen ? 'Close' : 'Menu'}</span>
            </Button>
          </div>
        </div>

        <nav
          id="mobile-primary-navigation"
          aria-label="Main navigation"
          className={mobileMenuOpen ? 'grid gap-1 border-t border-border py-3 lg:hidden' : 'hidden lg:hidden'}
        >
          {primaryLinks.map((link) => (
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
          {adminLinks.length > 0 && (
            <>
              <div className="mt-2 border-t border-border pt-2">
                <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Admin
                </p>
                <div className="grid gap-1">
                  {adminLinks.map((link) => (
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
                </div>
              </div>
            </>
          )}
          {authUser && (
            <Button
              type="button"
              variant="outline"
              className="mt-2 w-full justify-start md:hidden"
              onClick={signOut}
            >
              <LogOut className="size-4" />
              Sign out
            </Button>
          )}
        </nav>
      </div>
    </header>
  );
}
