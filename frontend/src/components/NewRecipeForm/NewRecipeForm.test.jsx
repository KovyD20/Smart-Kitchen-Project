// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

// The contexts only provide a toast and a confirm; stubbing them keeps this a
// test of the form rather than of the providers.
const showToast = vi.fn();
vi.mock("../../context/ToastContext", () => ({ useToast: () => ({ showToast }) }));
vi.mock("../../context/ConfirmContext", () => ({ useConfirm: () => async () => true }));

const { default: NewRecipeForm } = await import("./NewRecipeForm");

// jsdom implements neither, and the picker calls both.
beforeEach(() => {
  showToast.mockClear();
  URL.createObjectURL = vi.fn(() => "blob:preview");
  URL.revokeObjectURL = vi.fn();
});
afterEach(cleanup);

// Blob.size is a getter, and allocating a real 20 MB buffer just to trip a size
// check would be wasteful -- so the size is redefined rather than filled.
const imageFile = ({ size } = {}) => {
  const file = new File(["x"], "photo.jpg", { type: "image/jpeg" });
  if (size !== undefined) Object.defineProperty(file, "size", { value: size });
  return file;
};

const fileInput = () => document.querySelector(".rform-image-input");
const preview = () => document.querySelector(".rform-image-preview");
const pick = (file) => fireEvent.change(fileInput(), { target: { files: [file] } });

// A minimally valid recipe, so submit() reaches the image branch.
const fillValid = () => {
  fireEvent.change(screen.getByPlaceholderText("pl. Négysajtos gnocchi"), {
    target: { value: "Gulyás" },
  });
  fireEvent.change(screen.getByPlaceholderText("Név"), {
    target: { value: "hagyma" },
  });
  fireEvent.change(screen.getByPlaceholderText("Menny."), {
    target: { value: "2" },
  });
  fireEvent.change(screen.getByPlaceholderText("1. lépés"), {
    target: { value: "Pirítsd meg" },
  });
};

describe("NewRecipeForm image picker", () => {
  it("shows a preview of a picked file", () => {
    render(<NewRecipeForm onCreate={vi.fn()} />);
    expect(preview()).toBeNull();

    pick(imageFile());

    expect(preview().getAttribute("src")).toBe("blob:preview");
    expect(showToast).not.toHaveBeenCalled();
  });

  it("rejects a non-image with a message instead of previewing it", () => {
    render(<NewRecipeForm onCreate={vi.fn()} />);

    pick(new File(["x"], "notes.pdf", { type: "application/pdf" }));

    expect(preview()).toBeNull();
    expect(showToast).toHaveBeenCalledWith("Csak képfájlt lehet feltölteni", "error");
  });

  it("rejects an oversized source file", () => {
    render(<NewRecipeForm onCreate={vi.fn()} />);

    pick(imageFile({ size: 20 * 1024 * 1024 }));

    expect(preview()).toBeNull();
    expect(showToast).toHaveBeenCalledWith("A kép túl nagy (max. 15 MB)", "error");
  });

  it("hands the picked file to onCreate", async () => {
    const onCreate = vi.fn();
    render(<NewRecipeForm onCreate={onCreate} />);
    fillValid();
    const file = imageFile();
    pick(file);

    await fireEvent.click(screen.getByText("Recept mentése"));

    expect(onCreate).toHaveBeenCalledTimes(1);
    expect(onCreate.mock.calls[0][1]).toEqual({ imageFile: file });
  });

  it("shows the recipe's existing image when editing", () => {
    render(
      <NewRecipeForm
        editMode
        recipe={{ id: "r1", name: "Gulyás", imageUrl: "https://img/old.webp" }}
        onSave={vi.fn()}
      />,
    );

    expect(preview().getAttribute("src")).toBe("https://img/old.webp");
  });

  it("clearing a stored image asks for its removal", async () => {
    const onSave = vi.fn();
    render(
      <NewRecipeForm
        editMode
        recipe={{
          id: "r1",
          name: "Gulyás",
          imageUrl: "https://img/old.webp",
          ingredients: [{ name: "hagyma", amount: 2, unit: "g" }],
          steps: ["Pirítsd meg"],
        }}
        onSave={onSave}
      />,
    );

    await fireEvent.click(screen.getByText("Kép törlése"));
    expect(preview()).toBeNull();

    await fireEvent.click(screen.getByText("Módosítások mentése"));

    expect(onSave.mock.calls[0][1]).toEqual({ imageFile: null, removeImage: true });
  });

  it("clearing a fresh pick on a recipe that has no stored image deletes nothing", async () => {
    const onCreate = vi.fn();
    render(<NewRecipeForm onCreate={onCreate} />);
    fillValid();
    pick(imageFile());

    await fireEvent.click(screen.getByText("Kép törlése"));

    await fireEvent.click(screen.getByText("Recept mentése"));
    expect(onCreate.mock.calls[0][1]).toEqual({ imageFile: null });
  });

  it("keeps the stored image untouched when the edit does not mention it", async () => {
    const onSave = vi.fn();
    render(
      <NewRecipeForm
        editMode
        recipe={{
          id: "r1",
          name: "Gulyás",
          imageUrl: "https://img/old.webp",
          ingredients: [{ name: "hagyma", amount: 2, unit: "g" }],
          steps: ["Pirítsd meg"],
        }}
        onSave={onSave}
      />,
    );

    await fireEvent.click(screen.getByText("Módosítások mentése"));

    expect(onSave.mock.calls[0][1]).toEqual({ imageFile: null, removeImage: false });
  });
});
