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

module.exports = router;
