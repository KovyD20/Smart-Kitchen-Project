// @vitest-environment jsdom
import { afterEach, describe, it, expect } from "vitest";
import { cleanup, render } from "@testing-library/react";
import RecipeView from "./RecipeView";

// `sourceUrl` is written only by the link import, so every other recipe -- and
// every recipe saved before the feature existed -- must render exactly as it did.
const baseProps = {
  ingredients: [],
  steps: [],
  fridge: [],
  resolveCatalogKey: () => null,
  servings: 4,
  isMobile: false,
  onServingsChange: () => {},
  onStartCook: () => {},
  onAddIngredient: () => {},
  onAddAllToCart: () => {},
  onAddMissingToCart: () => {},
  onToggleFavorite: () => {},
  onEdit: () => {},
  onDelete: () => {},
  onGoToRecipes: () => {},
};

const renderRecipe = (recipe, props) =>
  render(<RecipeView {...baseProps} recipe={recipe} {...props} />);

const sourceLink = () => document.querySelector(".recipe-source");

afterEach(cleanup);

describe("RecipeView source link", () => {
  it("is absent on a recipe with no source", () => {
    renderRecipe({ name: "Gulyás" });
    expect(sourceLink()).toBeNull();
  });

  it("shows the site name, not the whole URL", () => {
    renderRecipe({
      name: "Gulyás",
      sourceUrl: "https://www.nosalty.hu/recept/gulyasleves",
    });
    expect(sourceLink().textContent).toBe("nosalty.hu");
  });

  it("links to the original and opens it safely in a new tab", () => {
    const url = "https://receptek.hu/gulyas";
    renderRecipe({ name: "Gulyás", sourceUrl: url });

    expect(sourceLink().getAttribute("href")).toBe(url);
    expect(sourceLink().getAttribute("target")).toBe("_blank");
    // Without noopener the opened page gets a handle on this one.
    expect(sourceLink().getAttribute("rel")).toContain("noopener");
  });

  it("keeps the full URL in the tooltip", () => {
    const url = "https://receptek.hu/husos/gulyasleves-nagymama-modra";
    renderRecipe({ name: "Gulyás", sourceUrl: url });
    expect(sourceLink().getAttribute("title")).toBe(url);
  });

  // A stored javascript: value would otherwise become a clickable script.
  it("refuses a non-http scheme", () => {
    for (const sourceUrl of ["javascript:alert(1)", "data:text/html,<b>x", "nem-url"]) {
      renderRecipe({ name: "Gulyás", sourceUrl });
      expect(sourceLink(), sourceUrl).toBeNull();
      cleanup();
    }
  });

  it("shows on mobile too", () => {
    renderRecipe(
      { name: "Gulyás", sourceUrl: "https://receptek.hu/gulyas" },
      { isMobile: true },
    );
    expect(sourceLink().textContent).toBe("receptek.hu");
  });
});
