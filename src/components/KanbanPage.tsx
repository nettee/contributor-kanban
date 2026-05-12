"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FilterControls, type ContributorFilter, REFRESH_OPTIONS } from "@/src/components/FilterControls";
import { KanbanBoard } from "@/src/components/KanbanBoard";
import { RefreshStatus } from "@/src/components/RefreshStatus";
import { KANBAN_COLUMNS, type ErrorResponse, type KanbanResponse, type PullRequestCard } from "@/src/kanban/types";

const DEFAULT_REFRESH_MINUTES: (typeof REFRESH_OPTIONS)[number] = 10;

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

  const fetchBoard = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    const hasExistingBoard = boardRef.current !== null;

    setError(null);

    if (hasExistingBoard) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    try {
      const response = await fetch(`/api/kanban?refreshToken=${Date.now()}`, {
        cache: "no-store",
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

      const message = caughtError instanceof Error ? caughtError.message : "Unknown error";

      setError({
        error: "Network error",
        detail: message,
      });
    } finally {
      if (!isMountedRef.current || requestId !== requestIdRef.current) {
        return;
      }

      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    void fetchBoard();

    return () => {
      isMountedRef.current = false;
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

  const totalCards = board?.columns.reduce((sum, column) => sum + column.cards.length, 0) ?? 0;
  const visibleCards = visibleColumns.reduce((sum, column) => sum + column.cards.length, 0);

  return (
    <main className="relative min-h-screen overflow-hidden px-6 py-8 text-slate-100 md:px-8 lg:px-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.14),_transparent_38%),radial-gradient(circle_at_75%_20%,_rgba(192,132,252,0.12),_transparent_30%)]" />

      <div className="relative mx-auto flex max-w-7xl flex-col gap-6">
        <section className="rounded-[2.4rem] border border-white/10 bg-slate-950/55 p-7 shadow-[0_30px_90px_rgba(2,6,23,0.45)] backdrop-blur-2xl md:p-9">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.45em] text-cyan-300/90">Contributor Kanban</p>
              <h1 className="mt-4 text-4xl leading-tight text-white md:text-5xl" style={{ fontFamily: "var(--font-display)" }}>
                nexu-io/open-design PR 看板
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300 md:text-lg">
                在单页里追踪所有 open PR 的流转状态，按贡献者类型筛选，并通过自动轮询保持看板信息新鲜可见。
              </p>
            </div>

            <div className="grid gap-3 rounded-[1.8rem] border border-white/10 bg-white/5 p-4 text-sm text-slate-200 sm:grid-cols-2 lg:min-w-80">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">当前视图</p>
                <p className="mt-2 text-2xl font-semibold text-white">{visibleCards}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">全部 PR</p>
                <p className="mt-2 text-2xl font-semibold text-white">{totalCards}</p>
              </div>
            </div>
          </div>
        </section>

        <FilterControls
          filter={filter}
          refreshMinutes={refreshMinutes}
          isRefreshing={isRefreshing}
          onFilterChange={setFilter}
          onRefreshMinutesChange={setRefreshMinutes}
          onRefreshNow={() => {
            void fetchBoard();
          }}
        />

        <RefreshStatus
          isLoading={isLoading}
          isRefreshing={isRefreshing}
          lastRefreshedAt={board?.refreshedAt}
          error={error}
          rateLimit={board?.rateLimit}
        />

        <KanbanBoard columns={visibleColumns} isLoading={isLoading && !board} refreshedAt={board?.refreshedAt} />
      </div>
    </main>
  );
}
