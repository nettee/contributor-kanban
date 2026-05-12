import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import HomePage from "./page";

describe("HomePage", () => {
  it("renders the initialized kanban shell", () => {
    render(<HomePage />);

    expect(screen.getByRole("heading", { name: "nexu-io/open-design PR 看板" })).toBeInTheDocument();
    expect(screen.getByText(/Next\.js、TypeScript、Tailwind/)).toBeInTheDocument();
  });
});
