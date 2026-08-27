// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";

import {
  DELETE_FIELD,
  emitError,
  emitSnapshot,
  firestoreMock,
  resetListeners,
} from "./firestoreListenerMock";

// Storage is stubbed at the module boundary: lib/imageUpload has its own tests
// for the pixel work, so what matters here is the ORDER of doc write, upload and
// old-file delete -- that is where an orphaned or dangling file comes from.
const imageMock = {
  uploadRecipeImage: vi.fn(async ({ recipeId }) => `https://img/${recipeId}.webp`),
  deleteRecipeImage: vi.fn(async () => {}),
};

vi.mock("../firebase", () => ({ db: {} }));
vi.mock("firebase/firestore", () => firestoreMock);
vi.mock("../lib/imageUpload", () => imageMock);

const { useRecipes } = await import("./useRecipes");

const pathFor = (uid) => `users/${uid}/recipes`;

beforeEach(() => {
  resetListeners();
  imageMock.uploadRecipeImage.mockClear();
  imageMock.deleteRecipeImage.mockClear();
  firestoreMock.addDoc.mockResolvedValue({ id: "new1" });
});
afterEach(cleanup);

describe("useRecipes loading flag", () => {
  it("starts out loading, before the first snapshot arrives", () => {
    const { result } = renderHook(() => useRecipes("u1"));
    expect(result.current.recipesLoading).toBe(true);
    // The distinction that matters: no recipes yet, but not "no recipes".
    expect(result.current.recipes).toEqual([]);
  });

  it("stops loading once the first snapshot arrives", () => {
    const { result } = renderHook(() => useRecipes("u1"));

    act(() => emitSnapshot(pathFor("u1"), [{ id: "r1", name: "Gulyás" }]));

    expect(result.current.recipesLoading).toBe(false);
    expect(result.current.recipes).toEqual([{ id: "r1", name: "Gulyás" }]);
  });

  it("stops loading on an empty snapshot, so an empty list can render", () => {
    const { result } = renderHook(() => useRecipes("u1"));

    act(() => emitSnapshot(pathFor("u1"), []));

    expect(result.current.recipesLoading).toBe(false);
    expect(result.current.recipes).toEqual([]);
  });

  it("stops loading when the listener errors, rather than hanging", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { result } = renderHook(() => useRecipes("u1"));

    act(() => emitError(pathFor("u1")));

    expect(result.current.recipesLoading).toBe(false);
    spy.mockRestore();
  });

  it("re-arms on a uid change instead of keeping the old loaded state", () => {
    const { result, rerender } = renderHook(({ uid }) => useRecipes(uid), {
      initialProps: { uid: "u1" },
    });

    act(() => emitSnapshot(pathFor("u1"), [{ id: "r1", name: "Gulyás" }]));
    expect(result.current.recipesLoading).toBe(false);

    rerender({ uid: "u2" });
    expect(result.current.recipesLoading).toBe(true);

    act(() => emitSnapshot(pathFor("u2"), []));
    expect(result.current.recipesLoading).toBe(false);
  });

  it("is not loading without a uid, so the banner cannot stick open", () => {
    const { result } = renderHook(() => useRecipes(null));
    expect(result.current.recipesLoading).toBe(false);
  });

  it("flips the favorite flag on the recipe's own document", async () => {
    const { result } = renderHook(() => useRecipes("u1"));
    act(() => emitSnapshot(pathFor("u1"), [{ id: "r1", name: "Gulyásleves" }]));

    await act(() =>
      result.current.toggleFavorite({ id: "r1", favorite: false }),
    );

    expect(firestoreMock.updateDoc).toHaveBeenCalledWith(
      { path: "users/u1/recipes/r1" },
      { favorite: true },
    );
  });

  it("unfavorites an already favorite recipe", async () => {
    const { result } = renderHook(() => useRecipes("u1"));
    act(() => emitSnapshot(pathFor("u1"), []));

    await act(() => result.current.toggleFavorite({ id: "r1", favorite: true }));

    expect(firestoreMock.updateDoc).toHaveBeenCalledWith(
      { path: "users/u1/recipes/r1" },
      { favorite: false },
    );
  });

  it("treats a recipe with no favorite field as not a favorite", async () => {
    const { result } = renderHook(() => useRecipes("u1"));
    act(() => emitSnapshot(pathFor("u1"), []));

    await act(() => result.current.toggleFavorite({ id: "r1" }));

    expect(firestoreMock.updateDoc).toHaveBeenCalledWith(
      { path: "users/u1/recipes/r1" },
      { favorite: true },
    );
  });

  it("derives allTags from the snapshot", () => {
    const { result } = renderHook(() => useRecipes("u1"));

    act(() =>
      emitSnapshot(pathFor("u1"), [
        { id: "r1", name: "Gulyás", tags: ["magyar", "leves"] },
        { id: "r2", name: "Pörkölt", tags: ["magyar"] },
      ]),
    );

    expect(result.current.allTags).toEqual(["magyar", "leves"]);
  });
});

describe("useRecipes recipe images", () => {
  // Renders the hook with one existing recipe that already has an image.
  const withExisting = (recipe = { id: "r1", name: "Gulyás", imageUrl: "https://img/old.webp" }) => {
    const { result } = renderHook(() => useRecipes("u1"));
    act(() => emitSnapshot(pathFor("u1"), [recipe]));
    return result;
  };

  it("creates the document first, then patches it with the uploaded URL", async () => {
    const result = withExisting();

    await act(async () => {
      await result.current.createRecipe({ name: "Új" }, { imageFile: { type: "image/jpeg" } });
    });

    // The document must not carry an imageUrl on the way in: the id it is keyed
    // by does not exist until addDoc resolves.
    expect(firestoreMock.addDoc.mock.calls[0][1]).toEqual({ name: "Új" });
    expect(imageMock.uploadRecipeImage).toHaveBeenCalledWith({
      uid: "u1",
      recipeId: "new1",
      file: { type: "image/jpeg" },
    });
    expect(firestoreMock.updateDoc).toHaveBeenCalledWith(
      { path: "users/u1/recipes/new1" },
      { imageUrl: "https://img/new1.webp" },
    );
  });

  it("skips Storage entirely when no image was picked", async () => {
    const result = withExisting();

    await act(async () => {
      await result.current.createRecipe({ name: "Új" });
    });

    expect(imageMock.uploadRecipeImage).not.toHaveBeenCalled();
    expect(firestoreMock.updateDoc).not.toHaveBeenCalled();
  });

  it("flags a failed upload as an image-stage error, the recipe having been saved", async () => {
    const result = withExisting();
    imageMock.uploadRecipeImage.mockRejectedValueOnce(new Error("network"));

    let caught;
    await act(async () => {
      caught = await result.current
        .createRecipe({ name: "Új" }, { imageFile: {} })
        .catch((err) => err);
    });

    expect(firestoreMock.addDoc).toHaveBeenCalledTimes(1);
    expect(caught.stage).toBe("image");
  });

  it("uploads the replacement before deleting the previous file", async () => {
    const result = withExisting();
    const order = [];
    imageMock.uploadRecipeImage.mockImplementationOnce(async () => {
      order.push("upload");
      return "https://img/new.webp";
    });
    firestoreMock.updateDoc.mockImplementationOnce(async () => order.push("updateDoc"));
    imageMock.deleteRecipeImage.mockImplementationOnce(async () => order.push("delete-old"));

    await act(async () => {
      await result.current.updateRecipe("r1", { name: "Gulyás" }, { imageFile: {} });
    });

    expect(order).toEqual(["upload", "updateDoc", "delete-old"]);
    expect(imageMock.deleteRecipeImage).toHaveBeenCalledWith("https://img/old.webp");
    expect(firestoreMock.updateDoc.mock.calls[0][1]).toEqual({
      name: "Gulyás",
      imageUrl: "https://img/new.webp",
    });
  });

  it("removes the field, not just the file, when the image is cleared", async () => {
    const result = withExisting();

    await act(async () => {
      await result.current.updateRecipe("r1", { name: "Gulyás" }, { removeImage: true });
    });

    expect(firestoreMock.updateDoc.mock.calls[0][1]).toEqual({
      name: "Gulyás",
      imageUrl: DELETE_FIELD,
    });
    expect(imageMock.deleteRecipeImage).toHaveBeenCalledWith("https://img/old.webp");
    expect(imageMock.uploadRecipeImage).not.toHaveBeenCalled();
  });

  it("leaves the image alone on an edit that does not touch it", async () => {
    const result = withExisting();

    await act(async () => {
      await result.current.updateRecipe("r1", { name: "Átnevezve" });
    });

    expect(firestoreMock.updateDoc.mock.calls[0][1]).toEqual({ name: "Átnevezve" });
    expect(imageMock.deleteRecipeImage).not.toHaveBeenCalled();
  });

  it("deletes the Storage object along with the recipe", async () => {
    const result = withExisting();

    await act(async () => {
      await result.current.deleteRecipe("r1");
    });

    expect(firestoreMock.deleteDoc).toHaveBeenCalledWith({ path: "users/u1/recipes/r1" });
    expect(imageMock.deleteRecipeImage).toHaveBeenCalledWith("https://img/old.webp");
  });

  it("deletes an image-less recipe without a Storage call for a missing URL", async () => {
    const result = withExisting({ id: "r1", name: "Gulyás" });

    await act(async () => {
      await result.current.deleteRecipe("r1");
    });

    expect(imageMock.deleteRecipeImage).toHaveBeenCalledWith(null);
  });
});
