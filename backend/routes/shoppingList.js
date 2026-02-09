const express = require("express");
const fs = require("fs");
const path = require("path");
const router = express.Router();

const filePath = path.join(__dirname, "../data/shopping-list.json");

function readList() {
  return JSON.parse(fs.readFileSync(filePath));
}

function writeList(data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// unit groups for merging
const UNIT_GROUPS = {
  weight: ["g", "dkg", "kg"],
  volume: ["ml", "dl", "l"],
};

const UNIT_FACTORS = {
  g: { group: "weight", factor: 1, base: "g" },
  dkg: { group: "weight", factor: 10, base: "g" },
  kg: { group: "weight", factor: 1000, base: "g" },
  ml: { group: "volume", factor: 1, base: "ml" },
  dl: { group: "volume", factor: 100, base: "ml" },
  l: { group: "volume", factor: 1000, base: "ml" },
};

function normalizeName(name) {
  return name.trim().toLowerCase();
}

function normalizeUnit(unit) {
  return (unit || "").toString().trim().toLowerCase();
}

function unitGroup(unit) {
  const u = normalizeUnit(unit);
  if (UNIT_GROUPS.weight.includes(u)) return "weight";
  if (UNIT_GROUPS.volume.includes(u)) return "volume";
  return u; // e.g. db
}

function toBaseAmount(amount, unit) {
  const u = normalizeUnit(unit);
  const meta = UNIT_FACTORS[u];
  if (!meta) return { amount: Number(amount), unit: u };
  return { amount: Number(amount) * meta.factor, unit: meta.base };
}

function roundAmount(value) {
  return Number(Number(value).toFixed(2));
}

function chooseDisplayAmountUnit(baseAmount, group) {
  const isInt = (v) => Math.abs(v - Math.round(v)) < 1e-9;
  if (group === "weight") {
    if (baseAmount >= 1000 && isInt(baseAmount / 1000)) {
      return { amount: baseAmount / 1000, unit: "kg" };
    }
    if (baseAmount >= 10 && isInt(baseAmount / 10)) {
      return { amount: baseAmount / 10, unit: "dkg" };
    }
    return { amount: baseAmount, unit: "g" };
  }
  if (group === "volume") {
    if (baseAmount >= 1000 && isInt(baseAmount / 1000)) {
      return { amount: baseAmount / 1000, unit: "l" };
    }
    if (baseAmount >= 100 && isInt(baseAmount / 100)) {
      return { amount: baseAmount / 100, unit: "dl" };
    }
    return { amount: baseAmount, unit: "ml" };
  }
  return { amount: baseAmount, unit: group };
}

// GET list
router.get("/", (req, res) => {
  res.json(readList());
});

// POST add items
router.post("/", (req, res) => {
  const incomingRaw = req.body; // [{ name, amount, unit }] or { name, amount, unit }
  const incoming = Array.isArray(incomingRaw) ? incomingRaw : [incomingRaw];
  let list = readList();
  const warnings = [];

  incoming.forEach((item) => {
    if (!item || !item.name || item.amount === undefined) return;

    const nameNorm = normalizeName(item.name);
    const unitNorm = normalizeUnit(item.unit);
    const group = unitGroup(unitNorm);

    const sameNameDifferentGroup = list.find(
      (l) =>
        normalizeName(l.name) === nameNorm && unitGroup(l.unit) !== group,
    );
    if (sameNameDifferentGroup) {
      warnings.push(
        `A tétel már szerepel más mértékegységgel: ${item.name.trim()}`,
      );
    }

    const existing = list.find(
      (l) =>
        normalizeName(l.name) === nameNorm &&
        unitGroup(l.unit) === group,
    );

    const incomingBase = toBaseAmount(item.amount, unitNorm);

    if (existing) {
      const existingBase = toBaseAmount(existing.amount, existing.unit);
      const newBaseAmount =
        Number(existingBase.amount) + Number(incomingBase.amount);

      if (newBaseAmount <= 0) {
        list = list.filter((l) => l !== existing);
        return;
      }

      if (group === "weight" || group === "volume") {
        const display = chooseDisplayAmountUnit(newBaseAmount, group);
        existing.amount = roundAmount(display.amount);
        existing.unit = display.unit;
      } else {
        existing.amount = roundAmount(newBaseAmount);
        existing.unit = incomingBase.unit || existing.unit;
      }
    } else if (Number(incomingBase.amount) > 0) {
      if (group === "weight" || group === "volume") {
        const display = chooseDisplayAmountUnit(incomingBase.amount, group);
        list.push({
          name: item.name.trim(),
          amount: roundAmount(display.amount),
          unit: display.unit,
        });
      } else {
        list.push({
          name: item.name.trim(),
          amount: roundAmount(incomingBase.amount),
          unit: incomingBase.unit || unitNorm,
        });
      }
    }
  });

  writeList(list);
  res.json({ success: true, warnings });
});

// DELETE - remove one item
router.delete("/:index", (req, res) => {
  const list = readList();
  const idx = Number(req.params.index);

  if (isNaN(idx) || !list[idx]) {
    return res.status(404).json({ error: "Item not found" });
  }

  list.splice(idx, 1);
  writeList(list);
  res.json({ success: true });
});

// DELETE - clear list
router.delete("/", (req, res) => {
  writeList([]);
  res.json({ success: true });
});

module.exports = router;
