import Link from "next/link";

type PageNavProps = {
  current: "kanban" | "analysis";
};

const ITEMS: Array<{ id: "kanban" | "analysis"; label: string; href: string }> = [
  { id: "kanban", label: "看板", href: "/" },
  { id: "analysis", label: "PR 分析", href: "/analysis" },
];

export function PageNav({ current }: PageNavProps) {
  return (
    <nav
      className="inline-flex overflow-hidden rounded-md border border-[var(--border)] bg-[var(--surface)]"
      aria-label="视图切换"
    >
      {ITEMS.map((item) => {
        const selected = item.id === current;
        const className = [
          "border-0 border-r border-[var(--border)] px-3 py-[5px] font-[var(--font-body)] text-xs font-normal leading-[18px] transition last:border-r-0",
          selected
            ? "bg-[var(--accent)] text-white"
            : "bg-transparent text-[var(--muted)] hover:bg-[var(--bg)] hover:text-[var(--label)]",
        ].join(" ");

        return (
          <Link key={item.id} href={item.href} aria-current={selected ? "page" : undefined} className={className}>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
