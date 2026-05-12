import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { KanbanResponse } from "@/src/kanban/types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import HomePage from "./page";

const boardResponse: KanbanResponse = {
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

    expect(screen.getByText("正在加载看板…")).toBeInTheDocument();

    deferred.resolve(jsonResponse(boardResponse));

    expect(await screen.findByText("@alice")).toBeInTheDocument();
  });

  it("renders card fields from the initial API payload", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(jsonResponse(boardResponse)));

    render(<HomePage />);

    expect(screen.getByRole("heading", { name: "nexu-io/open-design PR 看板" })).toBeInTheDocument();
    expect(await screen.findByText("@alice")).toBeInTheDocument();
    expect(screen.getByText("PR #101")).toBeInTheDocument();
    expect(screen.getAllByText("内部")).not.toHaveLength(0);
    expect(screen.getByText("Draft")).toBeInTheDocument();
    expect(screen.getAllByText(/活跃于/)).not.toHaveLength(0);
    expect(screen.getAllByText(/更新于/)).not.toHaveLength(0);
    expect(screen.getByText(/上次刷新/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Draft onboarding refresh/ })).toBeInTheDocument();
  });

  it("filters cards by contributor type without navigation", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(jsonResponse(boardResponse)));

    render(<HomePage />);

    expect(await screen.findByText("@alice")).toBeInTheDocument();
    expect(screen.getByText("@bob")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "外部" }));

    expect(screen.queryByText("@alice")).not.toBeInTheDocument();
    expect(screen.getByText("@bob")).toBeInTheDocument();
    expect(screen.getByText("@dora")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "内部" }));

    expect(screen.getByText("@alice")).toBeInTheDocument();
    expect(screen.getByText("@carol")).toBeInTheDocument();
    expect(screen.queryByText("@bob")).not.toBeInTheDocument();
  });

  it("triggers a second request when refresh now is clicked", async () => {
    fetchMock
      .mockImplementationOnce(() => Promise.resolve(jsonResponse(boardResponse)))
      .mockImplementationOnce(() => Promise.resolve(jsonResponse(boardResponse)));

    render(<HomePage />);

    expect(await screen.findByText("@alice")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "立即刷新" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
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

    const intervalSelect = screen.getByLabelText("刷新间隔") as HTMLSelectElement;

    expect(intervalSelect.value).toBe("10");

    fireEvent.change(intervalSelect, { target: { value: "30" } });

    expect(intervalSelect.value).toBe("30");

    await act(async () => {
      vi.advanceTimersByTime(30 * 60 * 1000);
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);

    unmount();

    await act(async () => {
      vi.advanceTimersByTime(30 * 60 * 1000);
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
