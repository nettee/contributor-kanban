import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { KanbanResponse } from "@/src/kanban/types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import HomePage from "./page";

const boardResponse: KanbanResponse = {
  repository: "nexu-io/open-design",
  refreshedAt: "2026-05-12T11:58:00.000Z",
  rateLimit: { remaining: 4991, resetAt: "2026-05-12T13:00:00.000Z" },
  columns: [
    {
      id: "A",
      title: "未开始",
      cards: [
        {
          number: 101,
          title: "Draft onboarding refresh for first-time contributors with a much longer title",
          url: "https://github.com/nexu-io/open-design/pull/101",
          author: { login: "alice", isInternal: true },
          detailStatus: "Draft",
          activityAt: "2026-05-12T11:45:00.000Z",
          updatedAt: "2026-05-12T11:40:00.000Z",
          column: "A",
        },
      ],
    },
    {
      id: "B",
      title: "不可合并",
      cards: [
        {
          number: 102,
          title: "Fix failing visual regression snapshots in CI",
          url: "https://github.com/nexu-io/open-design/pull/102",
          author: { login: "bob", isInternal: false },
          detailStatus: "CI 未通过",
          activityAt: "2026-05-12T11:30:00.000Z",
          updatedAt: "2026-05-12T11:28:00.000Z",
          column: "B",
        },
      ],
    },
    { id: "C", title: "评审未通过", cards: [] },
    {
      id: "D",
      title: "处理中",
      cards: [
        {
          number: 103,
          title: "Refine icon spacing in modal footer",
          url: "https://github.com/nexu-io/open-design/pull/103",
          author: { login: "carol", isInternal: true },
          detailStatus: "合并状态计算中",
          activityAt: "2026-05-12T10:40:00.000Z",
          updatedAt: "2026-05-12T10:35:00.000Z",
          column: "D",
        },
      ],
    },
    {
      id: "E",
      title: "可合并",
      cards: [
        {
          number: 104,
          title: "Polish keyboard navigation states",
          url: "https://github.com/nexu-io/open-design/pull/104",
          author: { login: "dora", isInternal: false },
          detailStatus: "评审通过",
          activityAt: "2026-05-12T09:10:00.000Z",
          updatedAt: "2026-05-12T09:00:00.000Z",
          column: "E",
        },
      ],
    },
  ],
};

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    statusText: init?.statusText,
    headers: { "Content-Type": "application/json" },
  });
}

function deferredResponse() {
  let resolve!: (value: Response) => void;
  const promise = new Promise<Response>((resolver) => {
    resolve = resolver;
  });

  return { promise, resolve };
}

describe("HomePage", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("shows a loading state before the first payload resolves", async () => {
    const deferred = deferredResponse();
    fetchMock.mockReturnValueOnce(deferred.promise);

    render(<HomePage />);

    expect(screen.getAllByText("加载中…").length).toBeGreaterThan(0);

    deferred.resolve(jsonResponse(boardResponse));

    expect(await screen.findByText("alice")).toBeInTheDocument();
  });

  it("renders card fields from the initial API payload", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(jsonResponse(boardResponse)));

    render(<HomePage />);

    expect(await screen.findByText("nexu-io/open-design")).toBeInTheDocument();
    expect(screen.getByTestId("kanban-shell")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "nexu-io/open-design PR 看板" })).toBeNull();
    expect(screen.queryByText("当前视图")).toBeNull();
    expect(screen.queryByText("全部 PR")).toBeNull();
    expect(screen.queryByText(/在单页里追踪所有 open PR/)).toBeNull();
    expect(screen.getByText("alice")).toBeInTheDocument();
    expect(screen.getByText("#101")).toBeInTheDocument();
    expect(screen.getAllByText("内部")).not.toHaveLength(0);
    expect(screen.getByText("Draft")).toBeInTheDocument();
    expect(within(screen.getByTestId("pr-card-101")).getByText(/[前后]/)).toBeInTheDocument();
    expect(screen.queryByText(/活跃于/)).toBeNull();
    expect(screen.queryByText(/更新于/)).toBeNull();
    expect(screen.queryByText(/本次刷新/)).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent(/刷新/);
    expect(screen.getByRole("button", { name: "30m" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("heading", { name: /Draft onboarding refresh/ })).toBeInTheDocument();
  });

  it("renders prototype board columns, counts, empty text, and visual mappings", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(jsonResponse(boardResponse)));

    render(<HomePage />);

    expect(await screen.findByText("alice")).toBeInTheDocument();

    const columns = screen.getAllByRole("heading", { level: 2 });
    expect(columns.map((column) => column.textContent)).toEqual(["未开始", "不可合并", "评审未通过", "处理中", "可合并"]);
    expect(screen.getByLabelText("未开始 1 个 PR")).toHaveTextContent("1");
    expect(screen.getByLabelText("评审未通过 0 个 PR")).toHaveTextContent("0");
    expect(screen.getByText("暂无 PR")).toBeInTheDocument();

    expect(screen.getByText("未开始").closest("section")).toHaveAttribute("data-column-style", "col-draft");
    expect(screen.getByText("不可合并").closest("section")).toHaveAttribute("data-column-style", "col-blocked");
    expect(screen.getByText("评审未通过").closest("section")).toHaveAttribute("data-column-style", "col-changes");
    expect(screen.getByText("处理中").closest("section")).toHaveAttribute("data-column-style", "col-progress");
    expect(screen.getByText("可合并").closest("section")).toHaveAttribute("data-column-style", "col-ready");

    const aliceCard = screen.getByTestId("pr-card-101");
    expect(within(aliceCard).getByText("#101")).toBeInTheDocument();
    expect(within(aliceCard).getByText("alice")).toBeInTheDocument();
    expect(within(aliceCard).getByText("内部")).toBeInTheDocument();
    expect(within(aliceCard).getByText("Draft")).toBeInTheDocument();
    expect(within(aliceCard).queryByText("PR #101")).toBeNull();
    expect(within(aliceCard).queryByText(/更新于|本次刷新/)).toBeNull();
  });

  it("filters cards by contributor type without navigation", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(jsonResponse(boardResponse)));

    render(<HomePage />);

    expect(await screen.findByText("alice")).toBeInTheDocument();
    expect(screen.getByText("bob")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "外部" }));

    expect(screen.queryByText("alice")).not.toBeInTheDocument();
    expect(screen.getByText("bob")).toBeInTheDocument();
    expect(screen.getByText("dora")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "内部" }));

    expect(screen.getByText("alice")).toBeInTheDocument();
    expect(screen.getByText("carol")).toBeInTheDocument();
    expect(screen.queryByText("bob")).not.toBeInTheDocument();
  });

  it("triggers another detailed request when refresh now is clicked", async () => {
    fetchMock
      .mockImplementationOnce(() => Promise.resolve(jsonResponse(boardResponse)))
      .mockImplementationOnce(() => Promise.resolve(jsonResponse(boardResponse)));

    render(<HomePage />);

    expect(await screen.findByText("alice")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "刷新" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });
  });

  it("aborts the previous in-flight request when refresh now starts a new one", async () => {
    const firstResponse = deferredResponse();
    const secondResponse = deferredResponse();
    const signals: AbortSignal[] = [];

    fetchMock.mockImplementation((_input: RequestInfo | URL, init?: RequestInit) => {
      signals.push(init?.signal as AbortSignal);

      if (signals.length === 1) {
        return firstResponse.promise;
      }

      if (signals.length === 2) {
        return secondResponse.promise;
      }

      throw new Error(`Unexpected fetch call ${signals.length}`);
    });

    render(<HomePage />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    expect(signals[0].aborted).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "刷新" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    expect(signals[0].aborted).toBe(true);
    expect(signals[1].aborted).toBe(false);

    secondResponse.resolve(jsonResponse(boardResponse));
    expect(await screen.findByText("alice")).toBeInTheDocument();
  });

  it("shows API error details when the kanban endpoint fails", async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(
        jsonResponse(
          {
            error: "GitHub API error",
            detail: "rate limited",
            retryAt: "2026-05-12T12:05:00.000Z",
          },
          { status: 502, statusText: "Bad Gateway" },
        ),
      ),
    );

    render(<HomePage />);

    const alert = await screen.findByRole("alert");

    expect(alert).toHaveTextContent("error: GitHub API error");
    expect(alert).toHaveTextContent("detail: rate limited");
    expect(alert).toHaveTextContent("retryAt: 2026-05-12T12:05:00.000Z");
  });

  it("allows switching refresh intervals and uses the selected interval for auto refresh", async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation(() => Promise.resolve(jsonResponse(boardResponse)));

    const { unmount } = render(<HomePage />);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByRole("button", { name: "30m" })).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: "15m" }));

    expect(screen.getByRole("button", { name: "15m" })).toHaveAttribute("aria-pressed", "true");

    await act(async () => {
      vi.advanceTimersByTime(15 * 60 * 1000);
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);

    unmount();

    await act(async () => {
      vi.advanceTimersByTime(15 * 60 * 1000);
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
