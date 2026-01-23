const express = require("express");
const app = express();
const PORT = 3000;

const recipesRouter = require("./routes/recipes");

app.use(express.json());
app.use("/api/recipes", recipesRouter);

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});