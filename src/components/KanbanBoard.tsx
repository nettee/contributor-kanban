import type { KanbanColumn, KanbanColumnId } from "@/src/kanban/types";
import { PullRequestCard } from "@/src/components/PullRequestCard";

const COLUMN_STYLES: Record<KanbanColumnId, { className: string; dotClassName: string }> = {
  A: { className: "col-draft", dotClassName: "bg-[var(--muted)]" },
  B: { className: "col-blocked", dotClassName: "bg-[var(--danger)]" },
  C: { className: "col-changes", dotClassName: "bg-[var(--warning)]" },
  D: { className: "col-progress", dotClassName: "bg-[var(--accent)]" },
  E: { className: "col-ready", dotClassName: "bg-[var(--success)]" },
};

type KanbanBoardProps = {
  columns: KanbanColumn[];
  isLoading: boolean;
};

export function KanbanBoard({ columns, isLoading }: KanbanBoardProps) {
  return (
    <section className="overflow-x-auto pb-10 [-webkit-overflow-scrolling:touch]">
      <div className="grid min-h-[calc(100vh-80px)] min-w-[1100px] grid-cols-5 gap-4 max-[1200px]:grid-cols-[repeat(5,minmax(220px,1fr))] max-[1200px]:min-w-0 max-[768px]:grid-cols-[repeat(5,minmax(260px,1fr))] max-[768px]:gap-3">
        {columns.map((column) => {
          const isEmpty = column.cards.length === 0;
          const style = COLUMN_STYLES[column.id];

          return (
            <section
              key={column.id}
              className={`flex min-w-0 flex-col ${style.className}`}
              data-column-style={style.className}
            >
              <header className="mb-2 flex items-center gap-2 px-3 py-2.5">
                <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${style.dotClassName}`} />
                <h2 className="text-[13px] font-medium tracking-[0.01em] text-[var(--label)]">{column.title}</h2>
                <span
                  className="rounded-[10px] border border-[var(--border)] bg-[var(--bg)] px-1.5 font-[var(--font-mono)] text-[11px] font-medium leading-5 text-[var(--muted)] [font-variant-numeric:tabular-nums]"
                  aria-label={`${column.title} ${column.cards.length} 个 PR`}
                >
                  {column.cards.length}
                </span>
              </header>

              <div className="flex flex-1 flex-col gap-2">
                {isEmpty ? (
                  <div className="flex items-center justify-center rounded-md border border-dashed border-[var(--border)] px-4 py-8 text-center text-xs text-[var(--muted)]">
                    {isLoading ? "加载中…" : "暂无 PR"}
                  </div>
                ) : (
                  column.cards.map((card) => <PullRequestCard key={card.number} card={card} />)
                )}
              </div>
            </section>
          );
        })}
      </div>
    </section>
  );
}
