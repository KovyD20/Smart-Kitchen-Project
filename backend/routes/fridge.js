const express = require("express");
const fs = require("fs");
const path = require("path");
const router = express.Router();

const filePath = path.join(__dirname, "../data/fridge.json");

function readFridge() {
  return JSON.parse(fs.readFileSync(filePath));
}

function writeFridge(data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// GET – teljes hűtő
router.get("/", (req, res) => {
  res.json(readFridge());
});

// POST – tétel hozzáadás / összevonás
router.post("/", (req, res) => {
  const incoming = req.body; // { name, amount, unit }
  const fridge = readFridge();

  const nameNorm = incoming.name.trim().toLowerCase();

  const existing = fridge.find(
    i =>
      i.name.trim().toLowerCase() === nameNorm &&
      i.unit === incoming.unit
  );

  if (existing) {
    existing.amount += Number(incoming.amount);
  } else {
    fridge.push({
      name: incoming.name.trim(),
      amount: Number(incoming.amount),
      unit: incoming.unit,
    });
  }

  writeFridge(fridge);
  res.json({ success: true });
});

// DELETE – tétel törlése
router.delete("/:index", (req, res) => {
  const fridge = readFridge();
  const idx = Number(req.params.index);

  if (isNaN(idx) || !fridge[idx]) {
    return res.status(404).json({ error: "Item not found" });
  }

  fridge.splice(idx, 1);
  writeFridge(fridge);
  res.json({ success: true });
});

module.exports = router;
