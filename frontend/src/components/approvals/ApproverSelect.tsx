'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, ChevronDown, ChevronUp, Loader2, RotateCcw, X } from 'lucide-react';
import { getActiveApprovers } from '@/lib/approver-service';
import type { ApproverUser } from '@/types/approval';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export interface ApproverSelectProps {
  value?: string[];
  defaultValue?: string[];
  onChange?: (selectedIds: string[]) => void;
  disabled?: boolean;
  placeholder?: string;
  inputId?: string;
  maxApprovers?: number;
  className?: string;
}

export function ApproverSelect({
  value,
  defaultValue,
  onChange,
  disabled = false,
  placeholder = 'Select Approver',
  inputId,
  maxApprovers,
  className = '',
}: ApproverSelectProps) {
  const [approvers, setApprovers] = useState<ApproverUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uncontrolledIds, setUncontrolledIds] = useState<string[]>(defaultValue ?? []);
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ left: number; top: number; width: number; maxHeight: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuId = `${inputId ?? 'approver-select'}-options`;
  const selectedIds = value ?? uncontrolledIds;

  const fetchApprovers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setApprovers(await getActiveApprovers());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to fetch approvers');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void fetchApprovers();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [fetchApprovers]);

  useEffect(() => {
    function closeOnOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (!containerRef.current?.contains(target) && !menuRef.current?.contains(target)) setIsOpen(false);
    }
    document.addEventListener('mousedown', closeOnOutside);
    return () => document.removeEventListener('mousedown', closeOnOutside);
  }, []);

  const updateMenuPosition = useCallback(() => {
    const trigger = buttonRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const width = Math.min(rect.width, window.innerWidth - 16);
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
    const below = window.innerHeight - rect.bottom - 8;
    const above = rect.top - 8;
    const openAbove = below < 160 && above > below;
    const maxHeight = Math.max(96, Math.min(240, openAbove ? above : below));
    const top = openAbove ? Math.max(8, rect.top - maxHeight - 4) : rect.bottom + 4;
    setMenuPosition({ left, top, width, maxHeight });
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    function reposition() {
      updateMenuPosition();
    }
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    return () => {
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
  }, [isOpen, updateMenuPosition]);

  const approversById = useMemo(() => new Map(
    approvers.filter((item) => item.role === 'APPROVER').map((item) => [item.id, item]),
  ), [approvers]);
  const available = approvers.filter((item) => item.role === 'APPROVER' && !selectedIds.includes(item.id));
  const atLimit = Boolean(maxApprovers && selectedIds.length >= maxApprovers);

  function updateSelection(nextIds: string[]) {
    if (value === undefined) setUncontrolledIds(nextIds);
    onChange?.(nextIds);
  }

  return (
    <div ref={containerRef} className={`space-y-3 ${className}`} onKeyDown={(event) => {
      if (event.key === 'Escape') setIsOpen(false);
    }}>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium">Approval Sequence ({selectedIds.length}{maxApprovers ? ` / ${maxApprovers}` : ''})</span>
          {selectedIds.length > 0 && !disabled && (
            <button type="button" onClick={() => updateSelection([])} className="text-xs text-muted-foreground hover:text-destructive">Clear all</button>
          )}
        </div>
        {selectedIds.length === 0 ? (
          <div className="rounded-md border border-dashed p-3 text-center text-xs text-muted-foreground">
            No approvers selected. Approval sequence is strictly determined by the order selected below.
          </div>
        ) : (
          <div className="space-y-1.5">
            {selectedIds.map((id, index) => {
              const approver = approversById.get(id);
              return (
                <div key={id} className="flex items-center justify-between gap-2 rounded-lg border bg-card px-3 py-2 text-xs">
                  <div className="flex min-w-0 items-center gap-2">
                    <Badge variant="outline" className="shrink-0">Level {index + 1}</Badge>
                    <div className="truncate"><span className="font-medium">{approver?.fullName ?? `User (${id.slice(0, 8)}...)`}</span>{approver && <span className="ml-1 text-muted-foreground">({approver.email})</span>}</div>
                  </div>
                  {!disabled && (
                    <div className="flex shrink-0 items-center gap-1">
                      <Button type="button" variant="ghost" size="icon-xs" disabled={index === 0} title="Move up" aria-label="Move approver up" onClick={() => {
                        const next = [...selectedIds]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; updateSelection(next);
                      }}><ChevronUp className="size-3.5" /></Button>
                      <Button type="button" variant="ghost" size="icon-xs" disabled={index === selectedIds.length - 1} title="Move down" aria-label="Move approver down" onClick={() => {
                        const next = [...selectedIds]; [next[index + 1], next[index]] = [next[index], next[index + 1]]; updateSelection(next);
                      }}><ChevronDown className="size-3.5" /></Button>
                      <Button type="button" variant="ghost" size="icon-xs" aria-label={`Remove ${approver?.fullName ?? 'approver'}`} onClick={() => updateSelection(selectedIds.filter((selectedId) => selectedId !== id))}><X className="size-3.5" /></Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {!disabled && !atLimit && (
        <div className="relative">
          <button
            ref={buttonRef}
            id={inputId}
            type="button"
            className="inline-flex h-10 w-full items-center justify-between rounded-lg border border-border bg-background px-3 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50"
            aria-haspopup="listbox"
            aria-expanded={isOpen}
            aria-controls={menuId}
            onClick={() => {
              updateMenuPosition();
              setIsOpen((open) => !open);
            }}
          >
            <span>{placeholder}</span>
            {loading ? <Loader2 className="size-4 animate-spin" /> : <ChevronDown className="size-4" />}
          </button>
          {isOpen && menuPosition && typeof document !== 'undefined' && createPortal(
            <div
              ref={menuRef}
              id={menuId}
              role="listbox"
              aria-label="Available approvers"
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  setIsOpen(false);
                  buttonRef.current?.focus();
                } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Home' || event.key === 'End') {
                  event.preventDefault();
                  const options = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="option"]') ?? []);
                  if (options.length === 0) return;
                  const currentIndex = options.indexOf(document.activeElement as HTMLButtonElement);
                  const nextIndex = event.key === 'Home' ? 0
                    : event.key === 'End' ? options.length - 1
                      : event.key === 'ArrowDown' ? Math.min(currentIndex + 1, options.length - 1)
                        : Math.max(currentIndex <= 0 ? 0 : currentIndex - 1, 0);
                  options[nextIndex].focus();
                }
              }}
              style={{ position: 'fixed', left: menuPosition.left, top: menuPosition.top, width: menuPosition.width, maxHeight: menuPosition.maxHeight, zIndex: 1000 }}
              className="overflow-y-auto rounded-lg border bg-popover p-1 text-popover-foreground shadow-lg"
            >
              {loading ? (
                <div className="flex items-center justify-center gap-2 p-4 text-xs text-muted-foreground"><Loader2 className="size-4 animate-spin" />Loading approvers...</div>
              ) : error ? (
                <div className="space-y-2 p-3 text-center"><div className="flex items-center justify-center gap-2 text-xs text-destructive"><AlertCircle className="size-4" />{error}</div><Button type="button" variant="outline" size="sm" onClick={() => void fetchApprovers()}><RotateCcw className="mr-1 size-3" />Retry</Button></div>
              ) : available.length === 0 ? (
                <div className="p-3 text-center text-xs text-muted-foreground">No additional authorized approvers are available.</div>
              ) : available.map((approver) => (
                <button
                  key={approver.id}
                  type="button"
                  role="option"
                  aria-selected="false"
                  onClick={() => {
                    if (maxApprovers && selectedIds.length >= maxApprovers) return;
                    updateSelection([...selectedIds, approver.id]);
                    setIsOpen(false);
                    buttonRef.current?.focus();
                  }}
                  className="w-full rounded-md px-3 py-2 text-left text-xs hover:bg-accent hover:text-accent-foreground"
                >
                  <span className="block font-medium">{approver.fullName}</span>
                  <span className="block truncate text-muted-foreground">{approver.email}</span>
                </button>
              ))}
            </div>,
            document.body,
          )}
        </div>
      )}
      {atLimit && <p className="text-[11px] text-muted-foreground">Maximum limit of {maxApprovers} approvers reached.</p>}
    </div>
  );
}
