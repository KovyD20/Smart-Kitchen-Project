import { useState, useEffect } from "react";
import AnimatedList from "../components/AnimatedList/AnimatedList";
import BubbleMenu from "../components/BubbleMenu/BubbleMenu";
import RecipeDetails from "../components/RecipeDetails/RecipeDetails";
import LightPillar from "../components/Background/LightPillar";
import NewRecipeForm from "../components/NewRecipeForm/NewRecipeForm";

import "../components/AnimatedList/AnimatedList.css";
import "../components/BubbleMenu/BubbleMenu.css";
import "./Home.css";

export default function Home() {
  const [recipes, setRecipes] = useState([]);
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [filterTag, setFilterTag] = useState("all");
  const [allTags, setAllTags] = useState([]);

  useEffect(() => {
    fetch("/api/recipes")
      .then((res) => res.json())
      .then((data) => setRecipes(data))
      .catch(console.error);
  }, []);

  useEffect(() => {
    const tags = new Set();
    recipes.forEach((r) => r.tags?.forEach((t) => tags.add(t)));
    setAllTags([...tags]);
  }, [recipes]);

  const filteredRecipes = recipes.filter(
    (r) => filterTag === "all" || r.tags?.includes(filterTag)
  );

  const menuItems = [
    { label: "Receptek", href: "#", rotation: -8 },
    { label: "Bevásárlólista", href: "#", rotation: 8 },
    { label: "Hűtő", href: "#", rotation: 8 },
    { label: "AI-recept generálás", href: "#", rotation: 8 },
    { label: "Kapcsolat / Info", href: "#", rotation: -8 },
  ];

  return (
    <div className="home-page">
      <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none" }}>
        <LightPillar />
      </div>

      <BubbleMenu
        logo={<span style={{ fontWeight: 700 }}>Smart Kitchen</span>}
        items={menuItems}
        menuBg="#8a0f0f"
        menuContentColor="#000"
        useFixedPosition={false}
      />

      <div className="home-layout">
        <aside className="left-panel">
          <h3>Szűrés tag szerint</h3>
          <select
            value={filterTag}
            onChange={(e) => setFilterTag(e.target.value)}
          >
            <option value="all">Mind</option>
            {allTags.map((tag) => (
              <option key={tag} value={tag}>
                {tag}
              </option>
            ))}
          </select>

          <AnimatedList
            items={filteredRecipes.map((r) => r.name)}
            onItemSelect={(name) =>
              setSelectedRecipe(recipes.find((r) => r.name === name))
            }
          />
        </aside>

        <main className="center-panel">
          {selectedRecipe ? (
            <RecipeDetails recipe={selectedRecipe} />
          ) : (
            <p>Kattints egy receptre.</p>
          )}
        </main>

        <aside className="right-panel">
          <NewRecipeForm
            existingTags={allTags}
            onAddTag={(tag) =>
              setAllTags((prev) =>
                prev.includes(tag) ? prev : [...prev, tag]
              )
            }
            onRecipeCreated={(recipe) =>
              setRecipes((prev) => [...prev, recipe])
            }
          />
        </aside>
      </div>
    </div>
  );
}
