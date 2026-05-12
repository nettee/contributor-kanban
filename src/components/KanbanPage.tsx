"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FilterControls, type ContributorFilter, REFRESH_OPTIONS } from "@/src/components/FilterControls";
import { KanbanBoard } from "@/src/components/KanbanBoard";
import { RefreshStatus } from "@/src/components/RefreshStatus";
import { KANBAN_COLUMNS, type ErrorResponse, type KanbanResponse, type PullRequestCard } from "@/src/kanban/types";

const DEFAULT_REFRESH_MINUTES: (typeof REFRESH_OPTIONS)[number] = 30;

function matchesFilter(card: PullRequestCard, filter: ContributorFilter): boolean {
  if (filter === "all") {
    return true;
  }

  return filter === "internal" ? card.author.isInternal : !card.author.isInternal;
}

function isKanbanResponse(value: unknown): value is KanbanResponse {
  return typeof value === "object" && value !== null && "columns" in value && "refreshedAt" in value;
}

function isErrorResponse(value: unknown): value is ErrorResponse {
  return typeof value === "object" && value !== null && "error" in value;
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export function KanbanPage() {
  const [filter, setFilter] = useState<ContributorFilter>("all");
  const [refreshMinutes, setRefreshMinutes] = useState<(typeof REFRESH_OPTIONS)[number]>(DEFAULT_REFRESH_MINUTES);
  const [board, setBoard] = useState<KanbanResponse | null>(null);
  const [error, setError] = useState<ErrorResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const isMountedRef = useRef(false);
  const boardRef = useRef<KanbanResponse | null>(null);
  const requestIdRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchBoard = useCallback(async (options: { summary?: boolean } = {}) => {
    abortControllerRef.current?.abort();

    const requestId = ++requestIdRef.current;
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    const hasExistingBoard = boardRef.current !== null;

    setError(null);

    if (hasExistingBoard) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    try {
      const searchParams = new URLSearchParams({ refreshToken: String(Date.now()) });
      if (options.summary) {
        searchParams.set("summary", "1");
      }

      const response = await fetch(`/api/kanban?${searchParams.toString()}`, {
        cache: "no-store",
        signal: abortController.signal,
      });
      const payload = await readJson(response);

      if (!isMountedRef.current || requestId !== requestIdRef.current) {
        return;
      }

      if (!response.ok) {
        const apiError = isErrorResponse(payload)
          ? payload
          : {
              error: `Request failed (${response.status})`,
              detail: response.statusText || "Unknown error",
            };

        setError(apiError);
        return;
      }

      if (!isKanbanResponse(payload)) {
        setError({
          error: "Unexpected response",
          detail: "The kanban API returned an invalid payload.",
        });
        return;
      }

      boardRef.current = payload;
      setBoard(payload);
      setError(null);
    } catch (caughtError) {
      if (!isMountedRef.current || requestId !== requestIdRef.current) {
        return;
      }

      if (caughtError instanceof DOMException && caughtError.name === "AbortError") {
        return;
      }

      const message = caughtError instanceof Error ? caughtError.message : "Unknown error";

      setError({
        error: "Network error",
        detail: message,
      });
    } finally {
      if (abortControllerRef.current === abortController) {
        abortControllerRef.current = null;
      }

      if (!isMountedRef.current || requestId !== requestIdRef.current) {
        return;
      }

      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    void fetchBoard({ summary: true }).then(() => {
      if (isMountedRef.current) {
        void fetchBoard();
      }
    });

    return () => {
      isMountedRef.current = false;
      abortControllerRef.current?.abort();
    };
  }, [fetchBoard]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void fetchBoard();
    }, refreshMinutes * 60_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [fetchBoard, refreshMinutes]);

  const visibleColumns = useMemo(
    () =>
      KANBAN_COLUMNS.map((column) => {
        const currentColumn = board?.columns.find((item) => item.id === column.id);

        return {
          id: column.id,
          title: currentColumn?.title ?? column.title,
          cards: (currentColumn?.cards ?? []).filter((card) => matchesFilter(card, filter)),
        };
      }),
    [board, filter],
  );

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--fg)]">
      <header className="sticky top-0 z-50 border-b border-[var(--border)] bg-white/85 px-6 py-4 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-4">
          <div className="flex shrink-0 items-center gap-2 font-[var(--font-display)] text-lg font-medium tracking-[-0.01em] text-[var(--fg)]">
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 16 16" fill="currentColor" className="text-[var(--muted)]">
              <path d="M2 2.5A2.5 2.5 0 0 1 4.5 0h8.75a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75h-2.5a.75.75 0 0 1 0-1.5h1.75v-2h-8a1 1 0 0 0-.714 1.7.75.75 0 1 1-1.072 1.05A2.495 2.495 0 0 1 2 11.5Zm10.5-1h-8a1 1 0 0 0-1 1v6.708A2.486 2.486 0 0 1 4.5 9h8ZM5 12.25a.25.25 0 0 1 .25-.25h3.5a.25.25 0 0 1 .25.25v3.25a.25.25 0 0 1-.4.2l-1.45-1.087a.249.249 0 0 0-.3 0L5.4 15.7a.25.25 0 0 1-.4-.2Z" />
            </svg>
            <span>acme/platform</span>
          </div>

          <div className="ml-auto flex flex-wrap items-center gap-3">
            <FilterControls
              filter={filter}
              refreshMinutes={refreshMinutes}
              onFilterChange={setFilter}
              onRefreshMinutesChange={setRefreshMinutes}
            />
            <RefreshStatus
              isLoading={isLoading}
              isRefreshing={isRefreshing}
              lastRefreshedAt={board?.refreshedAt}
              error={error}
              onRefreshNow={() => {
                void fetchBoard();
              }}
            />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] px-6 py-6" data-testid="kanban-shell">
        <KanbanBoard columns={visibleColumns} isLoading={isLoading && !board} refreshedAt={board?.refreshedAt} />
      </main>
    </div>
  );
}
