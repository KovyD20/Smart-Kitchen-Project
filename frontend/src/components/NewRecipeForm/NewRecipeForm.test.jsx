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
  // A course is mandatory, so a "minimally valid" recipe has to pick one.
  fireEvent.click(screen.getByRole("radio", { name: "Főétel" }));
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
          tags: ["Főétel"],
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
          tags: ["Főétel"],
        }}
        onSave={onSave}
      />,
    );

    await fireEvent.click(screen.getByText("Módosítások mentése"));

    expect(onSave.mock.calls[0][1]).toEqual({ imageFile: null, removeImage: false });
  });
});

// Both the header and the trailing button carry the same label; the trailing one
// is the second, which is the point of it existing.
const trailingAdd = (label) =>
  screen.getAllByRole("button", { name: label })[1];
const nameInputs = () => screen.getAllByPlaceholderText("Név");
const stepInputs = () => document.querySelectorAll(".rform-textarea");

describe("NewRecipeForm adding rows from the bottom", () => {
  it("adds an ingredient row from the trailing button", () => {
    render(<NewRecipeForm onCreate={vi.fn()} />);
    expect(nameInputs()).toHaveLength(1);

    fireEvent.click(trailingAdd("Hozzávaló"));
    expect(nameInputs()).toHaveLength(2);
  });

  it("moves focus into the row it just added", () => {
    render(<NewRecipeForm onCreate={vi.fn()} />);
    fireEvent.click(trailingAdd("Hozzávaló"));
    expect(document.activeElement).toBe(nameInputs()[1]);
  });

  it("appends a row on Enter in the last ingredient", () => {
    render(<NewRecipeForm onCreate={vi.fn()} />);
    fireEvent.keyDown(nameInputs()[0], { key: "Enter" });

    expect(nameInputs()).toHaveLength(2);
    expect(document.activeElement).toBe(nameInputs()[1]);
  });

  it("leaves Enter alone in a row that is not the last", () => {
    render(<NewRecipeForm onCreate={vi.fn()} />);
    fireEvent.click(trailingAdd("Hozzávaló"));
    expect(nameInputs()).toHaveLength(2);

    // Correcting an earlier line must not insert rows underneath it.
    fireEvent.keyDown(nameInputs()[0], { key: "Enter" });
    expect(nameInputs()).toHaveLength(2);
  });

  it("appends a row on Enter from the amount field too", () => {
    render(<NewRecipeForm onCreate={vi.fn()} />);
    fireEvent.keyDown(screen.getByPlaceholderText("Menny."), { key: "Enter" });
    expect(nameInputs()).toHaveLength(2);
  });

  it("adds a step from the trailing button and focuses it", () => {
    render(<NewRecipeForm onCreate={vi.fn()} />);
    expect(stepInputs()).toHaveLength(1);

    fireEvent.click(trailingAdd("Lépés"));
    expect(stepInputs()).toHaveLength(2);
    expect(document.activeElement).toBe(stepInputs()[1]);
  });

  it("keeps Enter as a line break inside a step", () => {
    render(<NewRecipeForm onCreate={vi.fn()} />);
    fireEvent.keyDown(stepInputs()[0], { key: "Enter" });
    expect(stepInputs()).toHaveLength(1);
  });
});

describe("NewRecipeForm main category", () => {
  it("refuses to save without a course", () => {
    const onCreate = vi.fn();
    render(<NewRecipeForm onCreate={onCreate} />);

    // Everything else filled in; only the course is missing.
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
    fireEvent.click(screen.getByRole("button", { name: /Recept mentése/ }));

    expect(onCreate).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith("Válassz fő kategóriát", "error");
  });

  it("saves the chosen course as a tag", () => {
    const onCreate = vi.fn();
    render(<NewRecipeForm onCreate={onCreate} />);
    fillValid();
    fireEvent.click(screen.getByRole("button", { name: /Recept mentése/ }));

    expect(onCreate.mock.calls[0][0].tags).toEqual(["Főétel"]);
  });

  it("replaces the course instead of collecting several", () => {
    const onCreate = vi.fn();
    render(<NewRecipeForm onCreate={onCreate} />);
    fillValid();
    fireEvent.click(screen.getByRole("radio", { name: "Desszert" }));
    fireEvent.click(screen.getByRole("button", { name: /Recept mentése/ }));

    expect(onCreate.mock.calls[0][0].tags).toEqual(["Desszert"]);
  });

  it("keeps the user's own tags when the course changes", () => {
    const onCreate = vi.fn();
    render(
      <NewRecipeForm onCreate={onCreate} existingTags={["gyors"]} onAddTag={vi.fn()} />,
    );
    fillValid();
    fireEvent.click(screen.getByRole("button", { name: "gyors" }));
    fireEvent.click(screen.getByRole("radio", { name: "Leves" }));
    fireEvent.click(screen.getByRole("button", { name: /Recept mentése/ }));

    expect(onCreate.mock.calls[0][0].tags).toEqual(["gyors", "Leves"]);
  });

  it("keeps course names out of the user's tag list", () => {
    render(<NewRecipeForm onCreate={vi.fn()} existingTags={["Leves", "gyors"]} />);

    // "Leves" is a course, so it renders as a radio, not as a deletable chip.
    expect(screen.getByRole("radio", { name: "Leves" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Leves" })).toBeNull();
    expect(screen.getByRole("button", { name: "gyors" })).toBeTruthy();
  });

  it("selects the course when its name is typed as a new tag", () => {
    const onCreate = vi.fn();
    const onAddTag = vi.fn();
    render(<NewRecipeForm onCreate={onCreate} onAddTag={onAddTag} />);
    fillValid();

    fireEvent.change(screen.getByPlaceholderText("Új címke"), {
      target: { value: "Desszert" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^Címke$/ }));
    fireEvent.click(screen.getByRole("button", { name: /Recept mentése/ }));

    expect(onAddTag).not.toHaveBeenCalled();
    expect(onCreate.mock.calls[0][0].tags).toEqual(["Desszert"]);
  });
});


const groupNames = () => screen.queryAllByLabelText("Csoport neve");
const noteInputs = () => screen.getAllByLabelText("Megjegyzés");
const addGroup = () => fireEvent.click(screen.getByRole("button", { name: "Csoport" }));
const rows = () => document.querySelectorAll(".rform-ing");

// The drag payload is optional in the handlers, so a bare event is enough here.
const dragRow = (fromRow, toRow) => {
  fireEvent.dragStart(rows()[fromRow].querySelector(".rform-drag"));
  fireEvent.dragOver(rows()[toRow]);
  fireEvent.drop(rows()[toRow]);
};

describe("NewRecipeForm ingredient notes", () => {
  it("saves the note typed on the row itself", () => {
    const onCreate = vi.fn();
    render(<NewRecipeForm onCreate={onCreate} />);
    fillValid();

    fireEvent.change(noteInputs()[0], { target: { value: " apróra vágva " } });
    fireEvent.click(screen.getByRole("button", { name: /Recept mentése/ }));

    expect(onCreate.mock.calls[0][0].ingredients[0]).toEqual({
      name: "hagyma",
      amount: "2",
      unit: "g",
      note: "apróra vágva",
    });
  });

  it("stores no empty note key for a row left blank", () => {
    const onCreate = vi.fn();
    render(<NewRecipeForm onCreate={onCreate} />);
    fillValid();
    fireEvent.click(screen.getByRole("button", { name: /Recept mentése/ }));

    expect(onCreate.mock.calls[0][0].ingredients[0]).toEqual({
      name: "hagyma",
      amount: "2",
      unit: "g",
    });
  });
});

describe("NewRecipeForm ingredient groups", () => {
  it("shows no group heading until one is added", () => {
    render(<NewRecipeForm onCreate={vi.fn()} />);
    expect(groupNames()).toHaveLength(0);

    addGroup();
    expect(groupNames()).toHaveLength(1);
  });

  it("gives a new group one row to type into", () => {
    render(<NewRecipeForm onCreate={vi.fn()} />);
    expect(nameInputs()).toHaveLength(1);

    addGroup();
    expect(nameInputs()).toHaveLength(2);
  });

  it("applies the heading to every row under it", () => {
    const onCreate = vi.fn();
    render(<NewRecipeForm onCreate={onCreate} />);
    fillValid();

    addGroup();
    fireEvent.change(groupNames()[0], { target: { value: "A töltelékhez" } });
    fireEvent.change(nameInputs()[1], { target: { value: "gomba" } });
    fireEvent.change(screen.getAllByPlaceholderText("Menny.")[1], {
      target: { value: "300" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Recept mentése/ }));

    const saved = onCreate.mock.calls[0][0].ingredients;
    expect(saved[0].group).toBeUndefined();
    expect(saved[1]).toMatchObject({ name: "gomba", group: "A töltelékhez" });
  });

  it("keeps the rows when the group is dissolved", () => {
    const onCreate = vi.fn();
    render(<NewRecipeForm onCreate={onCreate} />);
    fillValid();

    addGroup();
    fireEvent.change(groupNames()[0], { target: { value: "A töltelékhez" } });
    fireEvent.change(nameInputs()[1], { target: { value: "gomba" } });
    fireEvent.change(screen.getAllByPlaceholderText("Menny.")[1], {
      target: { value: "300" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Csoport feloldása" }));

    expect(groupNames()).toHaveLength(0);
    expect(nameInputs()).toHaveLength(2);

    fireEvent.click(screen.getByRole("button", { name: /Recept mentése/ }));
    const saved = onCreate.mock.calls[0][0].ingredients;
    expect(saved).toHaveLength(2);
    expect(saved[1].group).toBeUndefined();
  });

  it("shows an edited recipe's groups as containers", () => {
    render(
      <NewRecipeForm
        editMode
        recipe={{
          id: "r1",
          name: "Rétes",
          ingredients: [
            { name: "liszt", amount: 500, unit: "g", group: "A tésztához" },
            { name: "alma", amount: 3, unit: "db", group: "A töltelékhez" },
          ],
          steps: ["Nyújtsd ki"],
          tags: ["Desszert"],
        }}
        onSave={vi.fn()}
      />,
    );

    expect(groupNames().map((input) => input.value)).toEqual([
      "A tésztához",
      "A töltelékhez",
    ]);
  });

  it("adds a row to the group whose own button was pressed", () => {
    render(<NewRecipeForm onCreate={vi.fn()} />);
    addGroup();
    // Two blocks now, each with its own trailing button; press the first one's.
    const trailing = screen.getAllByRole("button", { name: "Hozzávaló" });
    fireEvent.click(trailing[1]);

    // The new row belongs to the ungrouped block, so it sits above the group's.
    expect(nameInputs()).toHaveLength(3);
    expect(document.activeElement).toBe(nameInputs()[1]);
  });
});

describe("NewRecipeForm dragging rows between groups", () => {
  it("moves a row into another group", () => {
    const onCreate = vi.fn();
    render(<NewRecipeForm onCreate={onCreate} />);
    fillValid();

    addGroup();
    fireEvent.change(groupNames()[0], { target: { value: "A töltelékhez" } });
    fireEvent.change(nameInputs()[1], { target: { value: "gomba" } });
    fireEvent.change(screen.getAllByPlaceholderText("Menny.")[1], {
      target: { value: "300" },
    });

    // Drag the ungrouped "hagyma" onto the grouped "gomba".
    dragRow(0, 1);

    fireEvent.click(screen.getByRole("button", { name: /Recept mentése/ }));
    const saved = onCreate.mock.calls[0][0].ingredients;
    expect(saved.map((i) => [i.name, i.group])).toEqual([
      ["hagyma", "A töltelékhez"],
      ["gomba", "A töltelékhez"],
    ]);
  });

  it("reorders rows inside one group", () => {
    const onCreate = vi.fn();
    render(<NewRecipeForm onCreate={onCreate} />);
    fillValid();
    fireEvent.click(trailingAdd("Hozzávaló"));
    fireEvent.change(nameInputs()[1], { target: { value: "paprika" } });
    fireEvent.change(screen.getAllByPlaceholderText("Menny.")[1], {
      target: { value: "1" },
    });

    dragRow(1, 0);

    fireEvent.click(screen.getByRole("button", { name: /Recept mentése/ }));
    expect(
      onCreate.mock.calls[0][0].ingredients.map((i) => i.name),
    ).toEqual(["paprika", "hagyma"]);
  });
});
