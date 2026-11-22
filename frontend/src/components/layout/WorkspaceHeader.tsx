'use client';

import React, { useState } from 'react';
import NextLink from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  CheckCircle2,
  Database,
  FileText,
  LayoutDashboard,
  LogOut,
  Users,
} from 'lucide-react';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { ApiError } from '@/lib/api-client';
import { logout } from '@/services/auth';
import { toast } from 'sonner';

export function WorkspaceHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { authUser } = useAuth();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const navLinks = [
    { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { label: 'Contracts', href: '/contracts', icon: FileText },
    { label: 'Approvals', href: '/approvals', icon: CheckCircle2 },
    ...(authUser?.role === 'ADMIN'
      ? [
          { label: 'Users', href: '/admin/users', icon: Users },
          { label: 'Reference data', href: '/admin/reference-data', icon: Database },
        ]
      : []),
  ];

  async function handleSignOut() {
    setIsSigningOut(true);
    try {
      await logout();
      router.replace('/login');
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'Could not sign out.');
    } finally {
      setIsSigningOut(false);
    }
  }

  function renderNavigation(mode: 'sidebar' | 'mobile') {
    return navLinks.map((link) => {
      const isActive = pathname === link.href || pathname.startsWith(`${link.href}/`);
      const Icon = link.icon;
      const classes = mode === 'sidebar'
        ? `group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
            isActive
              ? 'bg-white text-primary shadow-md shadow-slate-950/10'
              : 'text-white/85 hover:bg-white/10 hover:text-white'
          }`
        : `inline-flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${
            isActive
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:bg-primary/10 hover:text-primary'
          }`;

      return (
        <NextLink
          key={link.href}
          href={link.href}
          aria-current={isActive ? 'page' : undefined}
          className={classes}
        >
          <span className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${
            mode === 'sidebar'
              ? isActive ? 'bg-primary/10 text-primary' : 'bg-white/10 text-white'
              : isActive ? 'bg-white/15' : ''
          }`}>
            <Icon className="size-4" />
          </span>
          {link.label}
        </NextLink>
      );
    });
  }

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col bg-sidebar text-sidebar-foreground shadow-xl shadow-slate-950/10 lg:flex">
        <NextLink href="/dashboard" className="flex items-center gap-3 border-b border-sidebar-border px-6 py-6">
          <span className="flex size-11 items-center justify-center rounded-2xl bg-white text-primary shadow-sm">
            <FileText className="size-5" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-bold leading-tight text-white">Contract Forms</span>
            <span className="block text-xs leading-tight text-white/70">Automation workspace</span>
          </span>
        </NextLink>

        <nav aria-label="Main navigation" className="flex-1 space-y-1 px-4 py-6">
          <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-white/55">Workspace</p>
          {renderNavigation('sidebar')}
        </nav>

        <div className="border-t border-sidebar-border p-4">
          <div className="mb-3 flex items-center gap-3 rounded-xl bg-white/10 p-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/15 text-sm font-bold text-white">
              {authUser?.fullName.slice(0, 1).toUpperCase() ?? '?'}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-semibold text-white">{authUser?.fullName ?? 'Loading profile...'}</span>
              <span className="mt-0.5 block text-[10px] uppercase tracking-wide text-white/65">{authUser?.role ?? 'Account'}</span>
            </span>
            <NotificationBell className="text-white hover:bg-white/10 hover:text-white" />
          </div>
          <Button
            type="button"
            variant="ghost"
            onClick={() => void handleSignOut()}
            disabled={isSigningOut}
            className="w-full justify-start gap-3 rounded-xl text-white/85 hover:bg-white/10 hover:text-white"
          >
            <LogOut className="size-4" />
            {isSigningOut ? 'Signing out...' : 'Sign out'}
          </Button>
        </div>
      </aside>

      <header className="sticky top-0 z-40 border-b border-border/70 bg-card/95 shadow-sm backdrop-blur lg:hidden">
        <div className="flex min-h-14 items-center justify-between gap-3 px-3 sm:px-5">
          <NextLink href="/dashboard" className="flex min-w-0 items-center gap-2.5 font-semibold">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <FileText className="size-4" />
            </span>
            <span className="truncate text-sm">Contract Forms <span className="text-primary">Automation</span></span>
          </NextLink>
          <div className="flex shrink-0 items-center gap-1">
            <NotificationBell />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => void handleSignOut()}
              disabled={isSigningOut}
              aria-label={isSigningOut ? 'Signing out' : 'Sign out'}
              title="Sign out"
            >
              <LogOut className="size-4" />
            </Button>
          </div>
        </div>
        <nav aria-label="Main navigation" className="flex gap-1 overflow-x-auto border-t border-border/60 px-3 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {renderNavigation('mobile')}
        </nav>
      </header>
    </>
  );
}
