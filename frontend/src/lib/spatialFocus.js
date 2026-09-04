// Geometry behind the arrow-key focus movement, shared by the page-wide
// navigation (useSpatialNav) and the grid navigation inside a list
// (useListKeyboardNav). Kept in one place so both obey the same rules.

function centerOf(rect) {
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

// How much two rects overlap along one axis. Negative means a gap.
function overlapOn(axis, a, b) {
  return axis === "x"
    ? Math.min(a.right, b.right) - Math.max(a.left, b.left)
    : Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
}

// Nearest neighbour of `origin` among `list`, in one direction.
//
// The two hard rules -- not preferences, requirements -- are what make the
// movement predictable:
//
//   * A horizontal move stays inside the origin's own horizontal band. Without
//     it, Right on the "Bevásárlólista" tab jumped up to the search field,
//     whose centre happens to sit 10px to the right, instead of to the "Hűtő"
//     tab 143px along the same row. Leaving a row is what Up and Down are for.
//   * A vertical move has to leave that band, so Down cannot pick the button
//     standing next to the current one.
//
// Only then does distance decide, with the cross-axis distance weighted -- and
// weighted much harder when the two boxes do not line up at all -- so a column
// stays a column.
export function bestInDirection(origin, direction, list) {
  const base = origin.getBoundingClientRect();
  const from = centerOf(base);
  const vertical = direction === "up" || direction === "down";
  const sign = direction === "down" || direction === "right" ? 1 : -1;

  let best = null;
  let bestScore = Infinity;

  for (const element of list) {
    if (element === origin || origin.contains(element)) continue;
    const rect = element.getBoundingClientRect();
    const to = centerOf(rect);

    const primary = vertical ? (to.y - from.y) * sign : (to.x - from.x) * sign;
    if (primary <= 1) continue;

    const bandOverlap = overlapOn("y", base, rect);
    if (vertical) {
      // Still shoulder to shoulder with the origin: not a vertical neighbour.
      const shared = Math.min(base.height, rect.height) * 0.5;
      if (bandOverlap > shared) continue;
    } else if (bandOverlap <= 0) {
      continue;
    }

    const cross = vertical ? Math.abs(to.x - from.x) : Math.abs(to.y - from.y);
    const alignment = vertical ? overlapOn("x", base, rect) : bandOverlap;
    const score = primary + cross * (alignment > 0 ? 0.3 : 2.5);

    if (score < bestScore) {
      bestScore = score;
      best = element;
    }
  }

  return best;
}
