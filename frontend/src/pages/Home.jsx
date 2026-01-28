import { useState, useEffect } from "react";
import AnimatedList from "../components/AnimatedList/AnimatedList";
import BubbleMenu from "../components/BubbleMenu/BubbleMenu";
import RecipeDetails from "../components/RecipeDetails/RecipeDetails.jsx";
import "../components/AnimatedList/AnimatedList.css";
import "../components/BubbleMenu/BubbleMenu.css";
import LightPillar from "../components/Background/LightPillar";
import './Home.css';


export default function Home() {
  const [recipes, setRecipes] = useState([]);
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [filterTag, setFilterTag] = useState("all");

  // Fetch receptek a Node.js backendből
  useEffect(() => {
    fetch("/api/recipes")
      .then((res) => res.json())
      .then((data) => setRecipes(data))
      .catch((err) => console.error(err));
  }, []);

  const filteredRecipes = recipes.filter(
    (recipe) =>
      filterTag === "all" || (recipe.tags && recipe.tags.includes(filterTag))
  );

  const handleSelectRecipe = (recipe) => setSelectedRecipe(recipe);
  const handleFilterChange = (tag) => setFilterTag(tag);

  const menuItems = [
    {
      label: "Receptek",
      href: "#",
      ariaLabel: "Home",
      rotation: -8,
      hoverStyles: { bgColor: "#3b82f6", textColor: "#ffffff" },
    },
    {
      label: "Bevásárlólista",
      href: "#",
      ariaLabel: "About",
      rotation: 8,
      hoverStyles: { bgColor: "#10b981", textColor: "#ffffff" },
    },
    {
      label: "Kedvencek",
      href: "#",
      ariaLabel: "Projects",
      rotation: 8,
      hoverStyles: { bgColor: "#f59e0b", textColor: "#ffffff" },
    },
    {
      label: "AI-recept generálás",
      href: "#",
      ariaLabel: "Blog",
      rotation: 8,
      hoverStyles: { bgColor: "#ef4444", textColor: "#ffffff" },
    },
    {
      label: "Kapcsolat / Info",
      href: "#",
      ariaLabel: "Contact",
      rotation: -8,
      hoverStyles: { bgColor: "#8b5cf6", textColor: "#ffffff" },
    },
  ];

return (
  <div className="home-page">
    {/* Háttér */}
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 0,
        pointerEvents: "none",
      }}
    >
      <LightPillar />
    </div>

    {/*BubbleMenu*/}
    <BubbleMenu
      logo={<span style={{ fontWeight: 700 }}>Smart Kitchen</span>}
      items={menuItems}
      menuAriaLabel="Toggle navigation"
      menuBg="#8a0f0f"
      menuContentColor="#000000"
      useFixedPosition={false}
      animationEase="back.out(1.5)"
      animationDuration={0.5}
      staggerDelay={0.12}
    />

    {/* Oldaltartalom */}
    <div
      style={{
        position: "relative",
        zIndex: 1,
        display: "flex",
        marginTop: "150px",
        alignItems: "flex-start",
        gap: "20px",
        padding: "0 20px",
      }}
    >
      {/* Bal panel */}
      <div style={{ width: "250px", flexShrink: 0 }}>
        <h3>Szűrés tag szerint:</h3>
        <select
          value={filterTag}
          onChange={(e) => handleFilterChange(e.target.value)}
        >
          <option value="all">Mind</option>
          <option value="vegetarian">Vegetáriánus</option>
          <option value="dessert">Desszert</option>
          <option value="quick">Gyors</option>
        </select>

        <AnimatedList
          items={filteredRecipes.map((r) => r.name)}
          onItemSelect={(itemName) => {
            const recipe = recipes.find((r) => r.name === itemName);
            setSelectedRecipe(recipe);
          }}
        />
      </div>

      {/* Jobb panel */}
      <div style={{ flex: 1 }}>
        {selectedRecipe ? (
          <RecipeDetails recipe={selectedRecipe} />
        ) : (
          <p>Kattints egy receptre a listából a részletekhez.</p>
        )}
      </div>
    </div>
  </div>
);


}
