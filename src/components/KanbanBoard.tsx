import type { KanbanColumn } from "@/src/kanban/types";
import { PullRequestCard } from "@/src/components/PullRequestCard";

type KanbanBoardProps = {
  columns: KanbanColumn[];
  isLoading: boolean;
  refreshedAt?: string;
};

export function KanbanBoard({ columns, isLoading, refreshedAt }: KanbanBoardProps) {
  return (
    <section className="overflow-x-auto pb-4">
      <div className="grid min-w-[1100px] grid-cols-5 gap-5">
        {columns.map((column) => {
          const isEmpty = column.cards.length === 0;

          return (
            <section
              key={column.id}
              className="rounded-[2rem] border border-white/10 bg-slate-900/60 p-4 shadow-[0_24px_70px_rgba(2,6,23,0.35)] backdrop-blur-xl"
            >
              <header className="mb-4 border-b border-white/8 pb-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.35em] text-cyan-300/80">列 {column.id}</p>
                    <h2 className="mt-2 text-2xl font-semibold text-white">{column.title}</h2>
                  </div>
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm font-medium text-slate-200">
                    {column.cards.length}
                  </span>
                </div>
              </header>

              <div className="space-y-4">
                {isEmpty ? (
                  <div className="rounded-[1.4rem] border border-dashed border-white/10 bg-slate-950/45 px-4 py-6 text-sm text-slate-400">
                    {isLoading ? "加载中…" : "当前筛选条件下暂无 PR"}
                  </div>
                ) : (
                  column.cards.map((card) => <PullRequestCard key={card.number} card={card} refreshedAt={refreshedAt} />)
                )}
              </div>
            </section>
          );
        })}
      </div>
    </section>
  );
}
