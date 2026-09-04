// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { bestInDirection } from "./spatialFocus";

// jsdom does no layout, so every box is declared explicitly. The coordinates in
// the first block are the real ones, measured in Chrome at 1920x1080.
const box = (label, x1, y1, x2, y2) => {
  const el = document.createElement("button");
  el.textContent = label;
  el.getBoundingClientRect = () => ({
    left: x1,
    top: y1,
    right: x2,
    bottom: y2,
    width: x2 - x1,
    height: y2 - y1,
    x: x1,
    y: y1,
  });
  return el;
};

const name = (el) => (el ? el.textContent : null);

describe("bestInDirection: the desktop top bar", () => {
  // The regression this rule exists for. The search field's centre (977) sits
  // 10px to the right of the "Bevásárlólista" tab's centre (967), while the
  // next tab is 143px along the same row -- so plain distance picked the search
  // field and the last two tabs were unreachable with the arrows.
  const search = () => box("Keresés", 774, 20, 1181, 42);
  const help = () => box("?", 1553, 18, 1579, 44);
  const tabs = () => [
    box("Receptek", 620, 62, 751, 104),
    box("Recept", 761, 62, 876, 104),
    box("Bevásárlólista", 886, 62, 1049, 104),
    box("Hűtő", 1059, 62, 1161, 104),
    box("Új recept", 1171, 62, 1300, 104),
  ];

  it("walks along the tab bar instead of jumping up to the search field", () => {
    const list = [search(), help(), ...tabs()];
    const lista = list.find((el) => el.textContent === "Bevásárlólista");
    expect(name(bestInDirection(lista, "right", list))).toBe("Hűtő");
  });

  it("reaches the last tab", () => {
    const list = [search(), help(), ...tabs()];
    const huto = list.find((el) => el.textContent === "Hűtő");
    expect(name(bestInDirection(huto, "right", list))).toBe("Új recept");
  });

  it("stops at the end of the row rather than leaving it sideways", () => {
    const list = [search(), help(), ...tabs()];
    const last = list.find((el) => el.textContent === "Új recept");
    expect(bestInDirection(last, "right", list)).toBe(null);
  });

  it("goes up to the search field only when asked to go up", () => {
    const list = [search(), help(), ...tabs()];
    const lista = list.find((el) => el.textContent === "Bevásárlólista");
    expect(name(bestInDirection(lista, "up", list))).toBe("Keresés");
  });

  it("moves along the row the search field is in", () => {
    const list = [search(), help(), ...tabs()];
    expect(name(bestInDirection(list[0], "right", list))).toBe("?");
  });
});

describe("bestInDirection: a four-column grid", () => {
  // The recipe grid, also as measured: four 455px cards per row.
  const cards = () => {
    const cols = [
      [26, 481],
      [497, 952],
      [968, 1423],
      [1439, 1894],
    ];
    const rows = [
      [192, 412],
      [428, 648],
    ];
    return rows.flatMap((r, ri) =>
      cols.map((c, ci) => box(`k${ri * 4 + ci}`, c[0], r[0], c[1], r[1])),
    );
  };

  it("moves to the next card in the row, not the next in the document", () => {
    const list = cards();
    expect(name(bestInDirection(list[0], "right", list))).toBe("k1");
  });

  it("moves to the card directly below", () => {
    const list = cards();
    expect(name(bestInDirection(list[1], "down", list))).toBe("k5");
  });

  it("moves back up to the card directly above", () => {
    const list = cards();
    expect(name(bestInDirection(list[5], "up", list))).toBe("k1");
  });

  it("finds nothing to the left of the first column", () => {
    const list = cards();
    expect(bestInDirection(list[4], "left", list)).toBe(null);
  });

  it("finds nothing below the last row", () => {
    const list = cards();
    expect(bestInDirection(list[7], "down", list)).toBe(null);
  });
});

describe("bestInDirection: general rules", () => {
  it("prefers the box it lines up with over a nearer one off to the side", () => {
    const origin = box("origin", 0, 0, 100, 40);
    const aligned = box("aligned", 0, 200, 100, 240);
    const askew = box("askew", 900, 120, 1000, 160);
    const list = [origin, aligned, askew];
    expect(name(bestInDirection(origin, "down", list))).toBe("aligned");
  });

  it("never returns a box in the same row for a vertical move", () => {
    const origin = box("origin", 0, 0, 100, 40);
    const beside = box("beside", 200, 0, 300, 40);
    expect(bestInDirection(origin, "down", [origin, beside])).toBe(null);
  });

  it("ignores a box that is behind the origin", () => {
    const origin = box("origin", 200, 0, 300, 40);
    const before = box("before", 0, 0, 100, 40);
    expect(bestInDirection(origin, "right", [origin, before])).toBe(null);
    expect(name(bestInDirection(origin, "left", [origin, before]))).toBe("before");
  });
});
