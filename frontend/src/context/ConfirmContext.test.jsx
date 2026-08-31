// @vitest-environment jsdom
import { afterEach, describe, it, expect } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ConfirmProvider, useConfirm } from "./ConfirmContext";

// The dialog resolves a promise, so every assertion is about what that promise
// settles to -- the button that was pressed is only the means.
function Harness({ options }) {
  const confirm = useConfirm();
  return (
    <button
      type="button"
      onClick={async () => {
        const answer = await confirm("Biztosan törlöd?", options);
        document.title = String(answer);
      }}
    >
      opener
    </button>
  );
}

// document.title stands in for "what did the caller receive": it survives the
// dialog unmounting and needs no state of its own.
function open(options) {
  document.title = "pending";
  render(
    <ConfirmProvider>
      <Harness options={options} />
    </ConfirmProvider>,
  );
  const opener = screen.getByRole("button", { name: "opener" });
  opener.focus();
  fireEvent.click(opener);
  return opener;
}

const dialog = () => screen.getByRole("dialog");
const answer = async () => {
  // One turn of the microtask queue: the promise resolves in the same tick the
  // dialog settles, but the await in the caller runs after it.
  await act(async () => {});
  return document.title;
};

afterEach(cleanup);

describe("ConfirmProvider keyboard handling", () => {
  it("focuses the confirm button when it opens", () => {
    open();
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Rendben" }),
    );
  });

  it("resolves true on Enter", async () => {
    open();
    fireEvent.keyDown(document.activeElement, { key: "Enter" });
    expect(await answer()).toBe("true");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("resolves false on Escape", async () => {
    open();
    fireEvent.keyDown(dialog(), { key: "Escape" });
    expect(await answer()).toBe("false");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("cancels on Enter while the focus ring is on 'Mégse'", async () => {
    open();
    const cancel = screen.getByRole("button", { name: "Mégse" });
    cancel.focus();
    fireEvent.keyDown(cancel, { key: "Enter" });
    expect(await answer()).toBe("false");
  });

  it("returns focus to whatever opened it", async () => {
    const opener = open();
    fireEvent.keyDown(document.activeElement, { key: "Enter" });
    await answer();
    expect(document.activeElement).toBe(opener);
  });

  it("wraps Tab from the confirm button back to the cancel button", () => {
    open();
    fireEvent.keyDown(document.activeElement, { key: "Tab" });
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Mégse" }),
    );
  });

  it("wraps Shift+Tab from the cancel button to the confirm button", () => {
    open();
    const cancel = screen.getByRole("button", { name: "Mégse" });
    cancel.focus();
    fireEvent.keyDown(cancel, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Rendben" }),
    );
  });
});

describe("ConfirmProvider options", () => {
  it("defaults to neutral labels and no danger styling", () => {
    open();
    const accept = screen.getByRole("button", { name: "Rendben" });
    expect(accept.className).not.toContain("is-danger");
    expect(screen.getByRole("button", { name: "Mégse" })).toBeTruthy();
  });

  it("lets a destructive call name its action and colour it", () => {
    open({ danger: true, confirmLabel: "Törlés" });
    const accept = screen.getByRole("button", { name: "Törlés" });
    expect(accept.className).toContain("is-danger");
    // Still the focused default: Enter deletes, and the ring says so.
    expect(document.activeElement).toBe(accept);
  });

  it("still resolves true from a renamed confirm button", async () => {
    open({ confirmLabel: "Lista ürítése" });
    fireEvent.click(screen.getByRole("button", { name: "Lista ürítése" }));
    expect(await answer()).toBe("true");
  });

  it("keeps the backdrop click cancelling", async () => {
    open();
    fireEvent.click(document.querySelector(".confirm-overlay"));
    expect(await answer()).toBe("false");
  });
});
