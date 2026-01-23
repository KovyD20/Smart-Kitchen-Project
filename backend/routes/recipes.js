const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");

const filePath = path.join(__dirname, "../data/recipes.json");

//JSON beolvasása
function readRecipes() {
  const data = fs.readFileSync(filePath);
  return JSON.parse(data);
}

//JSON mentése
function writeRecipes(data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// GET all recipes
router.get("/", (req, res) => {
  const recipes = readRecipes();
  res.json(recipes);
});

// GET single recipe by id
router.get("/:id", (req, res) => {
  const recipes = readRecipes();
  const recipe = recipes.find(r => r.id === parseInt(req.params.id));
  if (!recipe) return res.status(404).json({ error: "Recipe not found" });
  res.json(recipe);
});

// POST create new recipe
router.post("/", (req, res) => {
  const recipes = readRecipes();
  const newRecipe = req.body;

  // automatic ID
  newRecipe.id = recipes.length ? recipes[recipes.length - 1].id + 1 : 1;

  recipes.push(newRecipe);
  writeRecipes(recipes);
  res.status(201).json(newRecipe);
});

// PUT update recipe
router.put("/:id", (req, res) => {
  const recipes = readRecipes();
  const index = recipes.findIndex(r => r.id === parseInt(req.params.id));
  if (index === -1) return res.status(404).json({ error: "Recipe not found" });

  recipes[index] = { ...recipes[index], ...req.body };
  writeRecipes(recipes);
  res.json(recipes[index]);
});

// DELETE recipe
router.delete("/:id", (req, res) => {
  let recipes = readRecipes();
  const index = recipes.findIndex(r => r.id === parseInt(req.params.id));
  if (index === -1) return res.status(404).json({ error: "Recipe not found" });

  const deleted = recipes.splice(index, 1)[0];
  writeRecipes(recipes);
  res.json(deleted);
});

module.exports = router;
