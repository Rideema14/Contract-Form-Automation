'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { getActiveApprovers } from '@/lib/approver-service';
import type { ApproverUser } from '@/types/approval';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Search,
  X,
  ChevronUp,
  ChevronDown,
  Loader2,
  AlertCircle,
  RotateCcw,
  UserCheck,
} from 'lucide-react';

export interface ApproverSelectProps {
  /** Array of selected approver user IDs in exact approval sequence */
  value?: string[];
  /** Default selected approver user IDs */
  defaultValue?: string[];
  /** Callback fired when the selection sequence changes */
  onChange?: (selectedIds: string[]) => void;
  /** Disables the entire component */
  disabled?: boolean;
  /** Placeholder text for the search input */
  placeholder?: string;
  /** Maximum number of approvers allowed */
  maxApprovers?: number;
  /** Optional container class name */
  className?: string;
}

function areArraysEqual(a: string[], b: string[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

export function ApproverSelect({
  value,
  defaultValue,
  onChange,
  disabled = false,
  placeholder = 'Search approvers by name or email...',
  maxApprovers,
  className = '',
}: ApproverSelectProps) {
  const [approvers, setApprovers] = useState<ApproverUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selected approver IDs in sequence
  const [selectedIds, setSelectedIds] = useState<string[]>(() => {
    return value ?? defaultValue ?? [];
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync internal selectedIds with controlled prop value safely without triggering loops
  useEffect(() => {
    if (value !== undefined) {
      setSelectedIds((prev) => (areArraysEqual(prev, value) ? prev : value));
    }
  }, [value]);

  // Fetch approvers from backend
  const fetchApprovers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getActiveApprovers();
      setApprovers(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch approvers';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchApprovers();
  }, [fetchApprovers]);

  // Close dropdown when clicking outside
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

  // Map of ID to ApproverUser for quick lookup
  const approversById = useMemo(() => {
    const map = new Map<string, ApproverUser>();
    for (const app of approvers) {
      map.set(app.id, app);
    }
    return map;
  }, [approvers]);

  // Available options filtering (excluding already selected approvers, matching query)
  const availableApprovers = useMemo(() => {
    const selectedSet = new Set(selectedIds);
    const query = searchQuery.trim().toLowerCase();

    return approvers.filter((app) => {
      const isAlreadySelected = selectedSet.has(app.id);
      if (isAlreadySelected) return false;

      if (!query) return true;
      return (
        app.fullName.toLowerCase().includes(query) ||
        app.email.toLowerCase().includes(query)
      );
    });
  }, [approvers, selectedIds, searchQuery]);

  const updateSelection = (nextIds: string[]) => {
    setSelectedIds(nextIds);
    onChange?.(nextIds);
  };

  const handleSelectApprover = (approverId: string) => {
    if (disabled) return;
    if (maxApprovers && selectedIds.length >= maxApprovers) return;
    if (selectedIds.includes(approverId)) return; // Prevent duplicate

    const nextIds = [...selectedIds, approverId];
    updateSelection(nextIds);
    setSearchQuery('');
    // Keep focus on input for sequential selection
    inputRef.current?.focus();
  };

  const handleRemoveApprover = (approverId: string) => {
    if (disabled) return;
    const nextIds = selectedIds.filter((id) => id !== approverId);
    updateSelection(nextIds);
  };

  const handleMoveUp = (index: number) => {
    if (disabled || index <= 0) return;
    const nextIds = [...selectedIds];
    const temp = nextIds[index - 1];
    nextIds[index - 1] = nextIds[index];
    nextIds[index] = temp;
    updateSelection(nextIds);
  };

  const handleMoveDown = (index: number) => {
    if (disabled || index >= selectedIds.length - 1) return;
    const nextIds = [...selectedIds];
    const temp = nextIds[index + 1];
    nextIds[index + 1] = nextIds[index];
    nextIds[index] = temp;
    updateSelection(nextIds);
  };

  const isAtLimit = Boolean(maxApprovers && selectedIds.length >= maxApprovers);

  return (
    <div ref={containerRef} className={`space-y-3 ${className}`}>
      {/* Selected Approvers List (Sequential Chips) */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-foreground">
            Approval Sequence ({selectedIds.length}
            {maxApprovers ? ` / ${maxApprovers}` : ''})
          </span>
          {selectedIds.length > 0 && !disabled && (
            <button
              type="button"
              onClick={() => updateSelection([])}
              className="text-[11px] text-muted-foreground hover:text-destructive transition-colors"
            >
              Clear all
            </button>
          )}
        </div>

        {selectedIds.length === 0 ? (
          <div className="rounded-md border border-dashed border-input p-3 text-center text-xs text-muted-foreground">
            No approvers selected. Approval sequence is strictly determined by the order selected below.
          </div>
        ) : (
          <div className="space-y-1.5">
            {selectedIds.map((id, index) => {
              const approver = approversById.get(id);
              const displayName = approver ? approver.fullName : `User (${id.slice(0, 8)}...)`;
              const displayEmail = approver ? approver.email : '';

              return (
                <div
                  key={id}
                  className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border bg-card text-card-foreground text-xs shadow-xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Badge variant="outline" className="shrink-0 bg-primary/10 text-primary border-primary/20 font-semibold">
                      Level {index + 1}
                    </Badge>
                    <div className="truncate">
                      <span className="font-medium text-foreground mr-1.5">{displayName}</span>
                      {displayEmail && (
                        <span className="text-muted-foreground text-[11px]">({displayEmail})</span>
                      )}
                    </div>
                  </div>

                  {!disabled && (
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => handleMoveUp(index)}
                        disabled={index === 0}
                        title="Move Up"
                        aria-label="Move Up in sequence"
                      >
                        <ChevronUp className="size-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => handleMoveDown(index)}
                        disabled={index === selectedIds.length - 1}
                        title="Move Down"
                        aria-label="Move Down in sequence"
                      >
                        <ChevronDown className="size-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => handleRemoveApprover(id)}
                        className="text-muted-foreground hover:text-destructive"
                        title="Remove approver"
                        aria-label={`Remove ${displayName}`}
                      >
                        <X className="size-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Search & Selection Dropdown */}
      {!disabled && !isAtLimit && (
        <div className="relative">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <Input
              ref={inputRef}
              type="text"
              placeholder={placeholder}
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if (!isOpen) setIsOpen(true);
              }}
              onFocus={() => setIsOpen(true)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setIsOpen(false);
                }
              }}
              disabled={disabled || loading}
              className="pl-8 text-xs h-9"
            />
            {loading && (
              <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 size-4 animate-spin text-muted-foreground" />
            )}
          </div>

          {/* Dropdown Results Box */}
          {isOpen && (
            <div className="absolute z-50 left-0 right-0 mt-1 max-h-60 overflow-y-auto rounded-lg border bg-popover text-popover-foreground shadow-md p-1 outline-hidden">
              {loading ? (
                <div className="flex items-center justify-center p-4 text-xs text-muted-foreground gap-2">
                  <Loader2 className="size-3.5 animate-spin" />
                  Loading approvers...
                </div>
              ) : error ? (
                <div className="p-3 text-center space-y-2">
                  <div className="flex items-center justify-center gap-1.5 text-xs text-destructive">
                    <AlertCircle className="size-3.5 shrink-0" />
                    <span>{error}</span>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={fetchApprovers}
                    className="text-xs h-7"
                  >
                    <RotateCcw className="size-3 mr-1" />
                    Retry
                  </Button>
                </div>
              ) : approvers.length === 0 ? (
                <div className="p-3 text-center text-xs text-muted-foreground">
                  No active approvers found in the system.
                </div>
              ) : availableApprovers.length === 0 ? (
                <div className="p-3 text-center text-xs text-muted-foreground">
                  {searchQuery.trim()
                    ? `No matching approvers found for "${searchQuery}".`
                    : 'All active approvers have already been selected.'}
                </div>
              ) : (
                <div className="space-y-0.5">
                  {availableApprovers.map((app) => (
                    <button
                      key={app.id}
                      type="button"
                      onClick={() => handleSelectApprover(app.id)}
                      className="w-full flex items-center justify-between px-2.5 py-1.5 text-left rounded-md hover:bg-accent hover:text-accent-foreground text-xs transition-colors"
                    >
                      <div className="min-w-0 pr-2">
                        <p className="font-medium truncate text-foreground">{app.fullName}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{app.email}</p>
                      </div>
                      <span className="shrink-0 text-[10px] text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded">
                        Add as Level {selectedIds.length + 1}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {isAtLimit && (
        <p className="text-[11px] text-muted-foreground">
          Maximum limit of {maxApprovers} approvers reached.
        </p>
      )}
    </div>
  );
}
