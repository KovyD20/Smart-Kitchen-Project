import { describe, expect, it } from "vitest";
import {
  flattenBlocks,
  moveIngredient,
  newBlock,
  toBlocks,
  ungroupBlock,
} from "./ingredientBlocks.js";

const item = (name, extra = {}) => ({ name, amount: 1, unit: "g", ...extra });

// Blocks carry generated ids; comparing on the readable parts keeps the
// expectations from depending on the id counter.
const shape = (blocks) =>
  blocks.map((block) => [block.group, block.items.map((i) => i.name)]);

describe("toBlocks", () => {
  it("gives an empty recipe one headingless block with one row", () => {
    const blocks = toBlocks(null);

    expect(blocks).toHaveLength(1);
    expect(blocks[0].group).toBeNull();
    expect(blocks[0].items).toHaveLength(1);
  });

  it("turns a flat list's groups into containers", () => {
    const blocks = toBlocks([
      item("liszt"),
      item("gomba", { group: "A töltelékhez" }),
      item("hagyma", { group: "A töltelékhez" }),
    ]);

    expect(shape(blocks)).toEqual([
      [null, ["liszt"]],
      ["A töltelékhez", ["gomba", "hagyma"]],
    ]);
  });

  it("strips the per-item group so the block is the only owner of it", () => {
    const blocks = toBlocks([item("gomba", { group: "A töltelékhez" })]);

    expect(blocks[0].items[0].group).toBeUndefined();
  });
});

describe("flattenBlocks", () => {
  it("stamps each row with its block's heading", () => {
    const flat = flattenBlocks([
      newBlock(null, [item("liszt")]),
      newBlock("A töltelékhez", [item("gomba")]),
    ]);

    expect(flat).toEqual([
      { name: "liszt", amount: 1, unit: "g" },
      { name: "gomba", amount: 1, unit: "g", group: "A töltelékhez" },
    ]);
  });

  it("drops a heading that was added but never typed into", () => {
    const flat = flattenBlocks([newBlock("", [item("liszt")])]);

    expect(flat[0].group).toBeUndefined();
  });

  it("leaves out the editor's row ids", () => {
    const flat = flattenBlocks([newBlock(null, [item("liszt")])]);

    expect(flat[0].id).toBeUndefined();
  });
});

describe("moveIngredient", () => {
  const blocks = () => [
    newBlock(null, [item("liszt"), item("só")]),
    newBlock("A töltelékhez", [item("gomba")]),
  ];

  it("moves a row into another block at the dropped position", () => {
    const before = blocks();
    const next = moveIngredient(
      before,
      { blockId: before[0].id, index: 0 },
      { blockId: before[1].id, index: 0 },
    );

    expect(shape(next)).toEqual([
      [null, ["só"]],
      ["A töltelékhez", ["liszt", "gomba"]],
    ]);
  });

  it("appends when the target index is null", () => {
    const before = blocks();
    const next = moveIngredient(
      before,
      { blockId: before[0].id, index: 0 },
      { blockId: before[1].id, index: null },
    );

    expect(shape(next)[1]).toEqual(["A töltelékhez", ["gomba", "liszt"]]);
  });

  it("lands on the dropped row when moving down inside one block", () => {
    const before = [newBlock(null, [item("a"), item("b"), item("c")])];
    const next = moveIngredient(
      before,
      { blockId: before[0].id, index: 0 },
      { blockId: before[0].id, index: 2 },
    );

    expect(shape(next)).toEqual([[null, ["b", "a", "c"]]]);
  });

  it("moves up inside one block without an off-by-one", () => {
    const before = [newBlock(null, [item("a"), item("b"), item("c")])];
    const next = moveIngredient(
      before,
      { blockId: before[0].id, index: 2 },
      { blockId: before[0].id, index: 0 },
    );

    expect(shape(next)).toEqual([[null, ["c", "a", "b"]]]);
  });

  it("leaves the list alone when the drag source is gone", () => {
    const before = blocks();
    expect(moveIngredient(before, null, { blockId: before[0].id, index: 0 })).toBe(
      before,
    );
  });
});

describe("ungroupBlock", () => {
  it("keeps the rows and drops only the heading", () => {
    const before = [
      newBlock(null, [item("liszt")]),
      newBlock("A töltelékhez", [item("gomba")]),
    ];

    expect(shape(ungroupBlock(before, before[1].id))).toEqual([
      [null, ["liszt", "gomba"]],
    ]);
  });

  it("does not merge across a heading that stays", () => {
    const before = [
      newBlock("A tésztához", [item("liszt")]),
      newBlock("A töltelékhez", [item("gomba")]),
      newBlock("A tetejére", [item("cukor")]),
    ];

    expect(shape(ungroupBlock(before, before[1].id))).toEqual([
      ["A tésztához", ["liszt"]],
      [null, ["gomba"]],
      ["A tetejére", ["cukor"]],
    ]);
  });
});
