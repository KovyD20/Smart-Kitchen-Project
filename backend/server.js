require("dotenv").config();
const express = require("express");
const app = express();
const PORT = 3000;

const recipesRouter = require("./routes/recipes");
const shoppingListRouter = require("./routes/shoppingList");
const fridgeRouter = require("./routes/fridge");
const aiRouter = require("./routes/ai");


app.use(express.json());
app.use("/api/recipes", recipesRouter);
app.use("/api/shopping-list", shoppingListRouter);
app.use("/api/fridge", fridgeRouter);
app.use("/api/ai", aiRouter);
  
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
