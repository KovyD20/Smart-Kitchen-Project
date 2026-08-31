import { cleanIngredient, groupIngredients } from "./recipes";

// The recipe editor's view of the ingredient list.
//
// Firestore stores one flat array where each item carries an optional `group`
// string. That is the right storage shape -- it survives an ingredient being
// renamed, reordered or regrouped without a second collection -- but it is the
// wrong *editing* shape: a heading typed once has to apply to a whole run of
// rows, and a row has to be draggable from one heading to another. So the form
// works on blocks and flattens on save. No React here, so the moves are unit
// testable on their own.

// Stable React keys. Index keys would be enough for controlled inputs, but a
// dragged row would then hand its DOM node (and the caret inside it) to whatever
// row slid into its place.
let idSeq = 0;
const nextId = (prefix) => `${prefix}${(idSeq += 1)}`;

export const emptyIngredient = () => ({
  id: nextId("ing"),
  name: "",
  amount: "",
  unit: "g",
  note: "",
});

// `group: null` is the headingless block every recipe starts with; `""` is a
// heading the user has added but not typed into yet.
export const newBlock = (group = null, items) => ({
  id: nextId("blk"),
  group,
  items: items?.length ? items : [emptyIngredient()],
});

export function toBlocks(ingredients) {
  const blocks = groupIngredients(ingredients).map((block) =>
    newBlock(
      block.group,
      // `group` is dropped from the item: the block owns it from here on, and a
      // stale copy on the row would silently win back on the next flatten.
      block.items.map(({ group, ...item }) => ({
        id: nextId("ing"),
        note: "",
        ...item,
      })),
    ),
  );

  return blocks.length ? blocks : [newBlock(null)];
}

export function flattenBlocks(blocks) {
  return (blocks || []).flatMap((block) =>
    block.items.map(({ id, ...item }) =>
      cleanIngredient({ ...item, group: block.group ?? "" }),
    ),
  );
}

// Moves one row to `to.index` inside the target block, or to its end when the
// index is null (dropped on the block's trailing zone).
export function moveIngredient(blocks, from, to) {
  const fromBlock = blocks.findIndex((block) => block.id === from?.blockId);
  const toBlock = blocks.findIndex((block) => block.id === to?.blockId);
  if (fromBlock < 0 || toBlock < 0) return blocks;

  const item = blocks[fromBlock].items[from.index];
  if (!item) return blocks;

  const next = blocks.map((block) => ({ ...block, items: [...block.items] }));
  next[fromBlock].items.splice(from.index, 1);

  let index = to.index;
  // Removing the row first shifts every later position in that same block down
  // by one, so a downward move inside one block would land a slot too high.
  if (index != null && fromBlock === toBlock && from.index < index) index -= 1;
  if (index == null || index > next[toBlock].items.length) {
    index = next[toBlock].items.length;
  }

  next[toBlock].items.splice(index, 0, item);
  return next;
}

// Drops a block's heading and keeps its rows. Two headingless blocks side by
// side are indistinguishable once the heading is gone, so they collapse.
export function ungroupBlock(blocks, blockId) {
  const cleared = (blocks || []).map((block) =>
    block.id === blockId ? { ...block, group: null } : block,
  );

  const merged = [];
  for (const block of cleared) {
    const last = merged[merged.length - 1];
    if (last && last.group === null && block.group === null) {
      merged[merged.length - 1] = {
        ...last,
        items: [...last.items, ...block.items],
      };
    } else {
      merged.push(block);
    }
  }

  return merged;
}
