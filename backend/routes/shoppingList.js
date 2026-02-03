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

// unit csoportok összevonáshoz
const UNIT_GROUPS = {
  weight: ["g", "dkg", "kg"],
  volume: ["ml", "dl", "l"],
};

function normalizeName(name) {
  return name.trim().toLowerCase();
}

function unitGroup(unit) {
  if (UNIT_GROUPS.weight.includes(unit)) return "weight";
  if (UNIT_GROUPS.volume.includes(unit)) return "volume";
  return unit; // pl. db
}

// GET lista
router.get("/", (req, res) => {
  res.json(readList());
});

// POST hozzávalók hozzáadása
router.post("/", (req, res) => {
  const incoming = req.body; // [{ name, amount, unit }]
  let list = readList();

  incoming.forEach(item => {
    const nameNorm = normalizeName(item.name);
    const group = unitGroup(item.unit);

    const existing = list.find(
      l =>
        normalizeName(l.name) === nameNorm &&
        unitGroup(l.unit) === group
    );

    if (existing) {
      existing.amount += Number(item.amount);
    } else {
      list.push({
        name: item.name.trim(),
        amount: Number(item.amount),
        unit: item.unit,
      });
    }
  });

  writeList(list);
  res.json({ success: true });
});

module.exports = router;
