const express = require("express");
const pool = require("../db/pool");

const router = express.Router();

router.get("/health", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW() AS db_time");
    return res.json({
      status: "ok",
      instance: process.env.INSTANCE_NAME || "local",
      db_time: result.rows[0].db_time,
    });
  } catch (err) {
    return res.status(500).json({
      status: "error",
      instance: process.env.INSTANCE_NAME || "local",
      error: err.message,
    });
  }
});

router.get("/items", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, name, created_at FROM demo_items ORDER BY id DESC"
    );
    return res.json({
      instance: process.env.INSTANCE_NAME || "local",
      items: result.rows,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.post("/items", async (req, res) => {
  const name = (req.body?.name || "").toString().trim();
  if (!name) {
    return res.status(400).json({ error: "name is required" });
  }

  try {
    const result = await pool.query(
      "INSERT INTO demo_items (name) VALUES ($1) RETURNING id, name, created_at",
      [name]
    );
    return res.status(201).json({
      instance: process.env.INSTANCE_NAME || "local",
      item: result.rows[0],
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
