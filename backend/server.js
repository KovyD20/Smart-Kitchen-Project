require("dotenv").config();
const express = require("express");
const app = express();
const PORT = Number(process.env.PORT || 3000);

const aiRouter = require("./routes/ai");
const dbRouter = require("./routes/db");
const pantryRouter = require("./routes/pantry");

app.use(express.json());
app.use("/api/ai", aiRouter);
app.use("/api/db", dbRouter);
app.use("/api/pantry", pantryRouter);

app.get("/health", (req, res) => {
  res.json({ status: "ok", instance: process.env.INSTANCE_NAME || "local" });
});

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
