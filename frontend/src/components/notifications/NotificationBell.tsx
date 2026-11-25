'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from '@/lib/notification-service';
import { apiGet, ApiError } from '@/lib/api-client';
import type { ApprovalHistoryResponse } from '@/types/approval';
import type { NotificationItem } from '@/types/notification';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Bell,
  CheckCheck,
  Loader2,
  AlertCircle,
  RotateCcw,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export function NotificationBell() {
  const router = useRouter();
  const { authUser } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getUserNotifications({ pageSize: 20 });
      setNotifications(data.items);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load notifications';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch on mount
  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void fetchNotifications();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [fetchNotifications]);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const handleToggle = () => {
    const nextState = !isOpen;
    setIsOpen(nextState);
    if (nextState) {
      fetchNotifications();
    }
  };

  const handleItemClick = async (item: NotificationItem) => {
    if (!item.isRead) {
      try {
        await markNotificationAsRead(item.id);
        setNotifications((prev) =>
          prev.map((n) => (n.id === item.id ? { ...n, isRead: true } : n))
        );
      } catch {
        // Continue navigation even if marking read fails
      }
    }

    setIsOpen(false);

    const contractId = item.contractFormId;
    if (
      typeof contractId !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(contractId)
    ) {
      toast.error('This notification is not linked to a valid contract.');
      return;
    }

    const contractPath = `/contracts/${encodeURIComponent(contractId)}`;
    const status = item.contractForm?.status;
    const section = status === 'APPROVED' ? 'approved'
      : status === 'RETURNED' ? 'returned'
        : status === 'REJECTED' ? 'rejected'
          : 'pending';
    const returnTo = `/approvals?status=${section}`;
    const viewHref = `${contractPath}?view=1&return=${encodeURIComponent(returnTo)}`;

    if (status === 'RETURNED') {
      router.push(`${contractPath}?edit=1&return=${encodeURIComponent(returnTo)}`);
      return;
    }

    if (status === 'APPROVED') {
      router.push(viewHref);
      return;
    }

    if (
      status === 'PENDING_APPROVAL' &&
      (authUser?.role === 'APPROVER' || authUser?.role === 'ADMIN')
    ) {
      try {
        const history = await apiGet<ApprovalHistoryResponse>(
          `/approvals/history/${encodeURIComponent(contractId)}`,
        );
        const activeStep = history.approvalSteps.find(
          (step) =>
            step.status === 'PENDING' &&
            (authUser.role === 'ADMIN' || step.approverId === authUser.id),
        );

        if (activeStep) {
          router.push(`/approvals/${encodeURIComponent(activeStep.id)}`);
        } else {
          toast.error('This contract is no longer awaiting your approval.');
          router.push(viewHref);
        }
      } catch (caught) {
        toast.error(
          caught instanceof ApiError
            ? caught.message
            : caught instanceof Error
              ? caught.message
              : 'Could not load approval details.',
        );
        router.push(viewHref);
      }
      return;
    }

    router.push(viewHref);
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch {
      // Ignore or let next refresh handle
    }
  };

  return (
    <div ref={containerRef} className="relative inline-block">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={handleToggle}
        className="relative"
        aria-label="Notifications"
        title="Notifications"
      >
        <Bell className="size-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </Button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl border bg-popover text-popover-foreground shadow-lg ring-1 ring-foreground/10 z-50 outline-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm">Notifications</span>
              {unreadCount > 0 && (
                <Badge variant="secondary" className="text-[11px] px-1.5 py-0 h-4">
                  {unreadCount} unread
                </Badge>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                title="Mark all as read"
              >
                <CheckCheck className="size-3.5" />
                <span>Mark all read</span>
              </button>
            )}
          </div>

          {/* Body */}
          <div className="max-h-80 overflow-y-auto divide-y divide-border/50">
            {loading && notifications.length === 0 ? (
              <div className="flex items-center justify-center py-8 text-xs text-muted-foreground gap-2">
                <Loader2 className="size-4 animate-spin" />
                <span>Loading notifications...</span>
              </div>
            ) : error && notifications.length === 0 ? (
              <div className="p-4 text-center space-y-2">
                <div className="flex items-center justify-center gap-1 text-xs text-destructive">
                  <AlertCircle className="size-4 shrink-0" />
                  <span>{error}</span>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={fetchNotifications}
                  className="text-xs h-7"
                >
                  <RotateCcw className="size-3 mr-1" />
                  Retry
                </Button>
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground">
                No notifications yet.
              </div>
            ) : (
              notifications.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => handleItemClick(item)}
                  className={`flex w-full items-start gap-3 p-3 text-left text-xs cursor-pointer transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    !item.isRead ? 'bg-primary/5' : ''
                  }`}
                >
                  <span
                    className={`mt-1.5 size-2 rounded-full shrink-0 ${
                      !item.isRead ? 'bg-primary' : 'bg-transparent'
                    }`}
                  />
                  <div className="flex-1 min-w-0 space-y-1">
                    <p className={`leading-snug ${!item.isRead ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>
                      {item.message}
                    </p>
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>{new Date(item.createdAt).toLocaleString()}</span>
                      {item.contractFormId && (
                        <span className="inline-flex items-center gap-0.5 text-primary text-[10px]">
                          View <ExternalLink className="size-2.5" />
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
