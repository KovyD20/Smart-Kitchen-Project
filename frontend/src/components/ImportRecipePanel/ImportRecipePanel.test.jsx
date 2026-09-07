// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from "vitest";
import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";
import ImportRecipePanel from "./ImportRecipePanel";

// The panel talks to the backend through authedFetch; the tests replace that,
// so what is under test is the panel's own behaviour -- what it sends, what it
// hands on, and what it says when the import fails.
const authedFetch = vi.hoisted(() => vi.fn());
vi.mock("../../lib/api", () => ({ authedFetch }));

const RECIPE = {
  name: "Gulyásleves",
  servings: 6,
  time_minutes: 90,
  ingredients: [{ name: "marhalábszár", amount: 50, unit: "dkg" }],
  steps: ["Pirítsd meg a hagymát."],
};

const jsonResponse = (body, { ok = true, status = 200 } = {}) => ({
  ok,
  status,
  json: async () => body,
});

const urlField = () => screen.getByLabelText("Recept linkje");
const importButton = () => screen.getByRole("button", { name: /Beolvasás/ });

const type = (value) => fireEvent.change(urlField(), { target: { value } });

afterEach(() => {
  cleanup();
  authedFetch.mockReset();
});

describe("ImportRecipePanel", () => {
  it("cannot be submitted while the field is empty", () => {
    render(<ImportRecipePanel onImported={() => {}} />);
    expect(importButton().disabled).toBe(true);
  });

  it("stays disabled for whitespace only", () => {
    render(<ImportRecipePanel onImported={() => {}} />);
    type("   ");
    expect(importButton().disabled).toBe(true);
  });

  it("posts the trimmed URL to the import endpoint", async () => {
    authedFetch.mockResolvedValue(jsonResponse({ recipe: RECIPE, sourceUrl: "u" }));
    render(<ImportRecipePanel onImported={() => {}} />);

    type("  https://receptek.hu/gulyas  ");
    fireEvent.click(importButton());

    await waitFor(() => expect(authedFetch).toHaveBeenCalledTimes(1));
    const [path, options] = authedFetch.mock.calls[0];
    expect(path).toBe("/api/ai/recipe-from-url");
    expect(options.method).toBe("POST");
    expect(JSON.parse(options.body)).toEqual({ url: "https://receptek.hu/gulyas" });
  });

  it("hands the recipe and its source URL to the caller", async () => {
    const onImported = vi.fn();
    authedFetch.mockResolvedValue(
      jsonResponse({ recipe: RECIPE, sourceUrl: "https://receptek.hu/gulyas" }),
    );
    render(<ImportRecipePanel onImported={onImported} />);

    type("https://receptek.hu/gulyas");
    fireEvent.click(importButton());

    await waitFor(() =>
      expect(onImported).toHaveBeenCalledWith(RECIPE, "https://receptek.hu/gulyas"),
    );
  });

  it("imports on Enter as well as on the button", async () => {
    authedFetch.mockResolvedValue(jsonResponse({ recipe: RECIPE, sourceUrl: "u" }));
    render(<ImportRecipePanel onImported={() => {}} />);

    type("https://receptek.hu/gulyas");
    fireEvent.keyDown(urlField(), { key: "Enter" });

    await waitFor(() => expect(authedFetch).toHaveBeenCalledTimes(1));
  });

  it("clears the field after a successful import", async () => {
    authedFetch.mockResolvedValue(jsonResponse({ recipe: RECIPE, sourceUrl: "u" }));
    render(<ImportRecipePanel onImported={() => {}} />);

    type("https://receptek.hu/gulyas");
    fireEvent.click(importButton());

    await waitFor(() => expect(urlField().value).toBe(""));
  });

  // Every backend failure has to arrive as something a cook can act on -- and
  // the wording per code already lives in lib/aiErrors.
  it("shows the Hungarian message for a bot-blocked page", async () => {
    authedFetch.mockResolvedValue(
      jsonResponse(
        { error: "The site refused the request", code: "URL_BLOCKED" },
        { ok: false, status: 502 },
      ),
    );
    render(<ImportRecipePanel onImported={() => {}} />);

    type("https://receptek.hu/gulyas");
    fireEvent.click(importButton());

    expect((await screen.findByRole("alert")).textContent).toMatch(
      /nem engedi a beolvasást/i,
    );
  });

  it("shows a message when the page holds no recipe", async () => {
    authedFetch.mockResolvedValue(
      jsonResponse(
        { error: "No recipe found at that URL", code: "URL_NO_RECIPE" },
        { ok: false, status: 422 },
      ),
    );
    render(<ImportRecipePanel onImported={() => {}} />);

    type("https://example.com/");
    fireEvent.click(importButton());

    expect((await screen.findByRole("alert")).textContent).toMatch(
      /nem találtunk receptet/i,
    );
  });

  it("does not hand anything on when the import fails", async () => {
    const onImported = vi.fn();
    authedFetch.mockResolvedValue(
      jsonResponse({ code: "URL_TIMEOUT" }, { ok: false, status: 504 }),
    );
    render(<ImportRecipePanel onImported={onImported} />);

    type("https://receptek.hu/gulyas");
    fireEvent.click(importButton());

    await screen.findByRole("alert");
    expect(onImported).not.toHaveBeenCalled();
  });

  it("survives a network failure with a readable message", async () => {
    authedFetch.mockRejectedValue(new Error("offline"));
    render(<ImportRecipePanel onImported={() => {}} />);

    type("https://receptek.hu/gulyas");
    fireEvent.click(importButton());

    expect((await screen.findByRole("alert")).textContent).toMatch(/nem sikerült/i);
  });

  it("clears a previous error as soon as the URL is edited", async () => {
    authedFetch.mockResolvedValue(
      jsonResponse({ code: "URL_NO_RECIPE" }, { ok: false, status: 422 }),
    );
    render(<ImportRecipePanel onImported={() => {}} />);

    type("https://example.com/");
    fireEvent.click(importButton());
    await screen.findByRole("alert");

    type("https://receptek.hu/gulyas");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  // A second click while the first request is still out would import twice.
  it("blocks a second submit while one is in flight", async () => {
    let release;
    authedFetch.mockReturnValue(
      new Promise((resolve) => {
        release = () => resolve(jsonResponse({ recipe: RECIPE, sourceUrl: "u" }));
      }),
    );
    render(<ImportRecipePanel onImported={() => {}} />);

    type("https://receptek.hu/gulyas");
    fireEvent.click(importButton());

    await waitFor(() => expect(importButton().disabled).toBe(true));
    fireEvent.click(importButton());
    fireEvent.keyDown(urlField(), { key: "Enter" });

    release();
    await waitFor(() => expect(authedFetch).toHaveBeenCalledTimes(1));
  });
});
