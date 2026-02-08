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
  const [editingRecipe, setEditingRecipe] = useState(null);
  const [filterTag, setFilterTag] = useState("all");
  const [allTags, setAllTags] = useState([]);
  const [showNewRecipeForm, setShowNewRecipeForm] = useState(false);
  const [shoppingList, setShoppingList] = useState([]);
  const [fridge, setFridge] = useState([]);
  const [newFridgeItem, setNewFridgeItem] = useState({
    name: "",
    amount: "",
    unit: "",
  });
  const UNITS = ["db","g", "dkg", "kg", "ml", "dl", "l"];
  const smallBtn = {
    padding: "3px 6px",
    fontSize: "15px",
    lineHeight: "1",
  };

  useEffect(() => {
    const fetchLists = async () => {
      try {
        const resShop = await fetch("/api/shopping-list");
        const shopData = await resShop.json();
        setShoppingList(shopData);

        const resFridge = await fetch("/api/fridge");
        const fridgeData = await resFridge.json();
        setFridge(fridgeData);
      } catch (err) {
        console.error("Hiba a listák lekérésekor", err);
      }
    };

    fetchLists();
  }, []);

  const addToShoppingList = async (ingredients) => {
    if (
      !window.confirm("Biztosan hozzáadod a hozzávalókat a bevásárlólistához?")
    )
      return;

    const res = await fetch("/api/shopping-list", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ingredients),
    });

    if (res.ok) {
      const updated = await fetch("/api/shopping-list");
      const data = await updated.json();
      setShoppingList(data);
      alert("✅ Sikeresen hozzáadva a bevásárlólistához");
    } else {
      alert("❌ Hiba történt");
    }
  };

  const addToFridge = async (item) => {
    const res = await fetch("/api/fridge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(item),
    });

    if (res.ok) {
      const updated = await fetch("/api/fridge").then((r) => r.json());
      setFridge(updated);
    } else {
      alert("❌ Hiba a hűtő frissítésekor");
    }
  };

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
    (r) => filterTag === "all" || r.tags?.includes(filterTag),
  );

  const menuItems = [
    { label: "Receptek", href: "#", rotation: -8 },
    { label: "Bevásárlólista", href: "#", rotation: 8 },
    { label: "Hűtő", href: "#", rotation: 8 },
    { label: "AI-recept generálás", href: "#", rotation: 8 },
    { label: "Kapcsolat ", href: "#", rotation: -8 },
  ];

  return (
    <div className="home-page">
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

      <BubbleMenu
        logo={<span style={{ fontWeight: 700 }}>RECEPTOR</span>}
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
            items={filteredRecipes.map((r) => ({
              id: r.id,
              label: r.name,
            }))}
            onItemSelect={(item) =>
              setSelectedRecipe(recipes.find((r) => r.id === item.id))
            }
          />
        </aside>

        <main className="center-panel">
          {editingRecipe ? (
            <NewRecipeForm
              editMode
              recipe={editingRecipe}
              existingTags={allTags}
              onSave={async (updated) => {
                const res = await fetch(`/api/recipes/${updated.id}`, {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(updated),
                });
                const saved = await res.json();
                setRecipes((prev) =>
                  prev.map((r) => (r.id === saved.id ? saved : r)),
                );
                setEditingRecipe(null);
                setSelectedRecipe(saved);
              }}
            />
          ) : selectedRecipe ? (
            <RecipeDetails
              recipe={selectedRecipe}
              onDelete={async (id) => {
                await fetch(`/api/recipes/${id}`, { method: "DELETE" });
                setRecipes((prev) => prev.filter((r) => r.id !== id));
                setSelectedRecipe(null);
              }}
              onEdit={() => setEditingRecipe(selectedRecipe)}
              onAddToShoppingList={addToShoppingList}
            />
          ) : (
            <p>Kattints egy receptre.</p>
          )}

          {/* <div className="lists-column"></div> */}
        </main>

        <div className="shopping-list">
          <h3>🛒 Bevásárlólista</h3>
          {shoppingList.length === 0 ? (
            <p>Üres</p>
          ) : (
            <ul>
              {shoppingList.map((item, i) => (
                <li key={i}>
                  {item.name} - {item.amount} {item.unit}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="fridge">
          <h3>🧊 Hűtő</h3>
          {fridge.length === 0 ? (
            <p>Üres</p>
          ) : (
            <ul>
              <div></div>
              {fridge.map((item, i) => (
                <li
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    marginBottom: "6px",
                  }}
                >
                  <span style={{ flex: 1 }}>
                   {item.name} - {item.amount} {item.unit} 
                  </span>
<div className="item-actions">
                  <button
                    style={smallBtn}
                    onClick={() =>
                      addToFridge({
                        name: item.name,
                        amount: 1,
                        unit: item.unit,
                      })
                    }
                  >
                    +
                  </button>

                  <button
                    style={smallBtn}
                    disabled={item.amount <= 1}
                    onClick={() =>
                      addToFridge({
                        name: item.name,
                        amount: -1,
                        unit: item.unit,
                      })
                    }
                  >
                    -
                  </button>

                  <button
                    style={smallBtn}
                    onClick={async () => {
                      if (!window.confirm("Biztosan törlöd?")) return;
                      await fetch(`/api/fridge/${i}`, { method: "DELETE" });
                      const updated = await fetch("/api/fridge").then((r) =>
                        r.json(),
                      );
                      setFridge(updated);
                    }}
                  >
                    🗑
                  </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="fridge-add">
            <input
              style={{ width: "80px" }}
              placeholder="név"
              value={newFridgeItem.name}
              onChange={(e) =>
                setNewFridgeItem((p) => ({ ...p, name: e.target.value }))
              }
            />

            <input
              style={{ width: "50px" }}
              type="number"
              min="0"
              step="1"
              placeholder="menny."
              value={newFridgeItem.amount}
              onChange={(e) => {
                const val = Math.max(0, Number(e.target.value));
                setNewFridgeItem((p) => ({ ...p, amount: val }));
              }}
            />

            <select
              value={newFridgeItem.unit}
              onChange={(e) =>
                setNewFridgeItem((p) => ({ ...p, unit: e.target.value }))
              }
            >
              {UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
            <div></div>
            <button
              onClick={() => {
                if (!newFridgeItem.name || !newFridgeItem.amount) return;

                addToFridge({
                  name: newFridgeItem.name,
                  amount: Number(newFridgeItem.amount),
                  unit: newFridgeItem.unit || "db",
                });

                setNewFridgeItem({ name: "", amount: "", unit: "" });
              }}
            >
              Tétel hozzáadása➕
            </button>
          </div>
        </div>

        <aside className="right-panel">
          <button onClick={() => setShowNewRecipeForm((prev) => !prev)}>
            Új Recept hozzáadása
          </button>

          {showNewRecipeForm && (
            <NewRecipeForm
              existingTags={allTags}
              onAddTag={(tag) =>
                setAllTags((prev) =>
                  prev.includes(tag) ? prev : [...prev, tag],
                )
              }
              onRecipeCreated={async () => {
                try {
                  const res = await fetch("/api/recipes");
                  const updatedRecipes = await res.json();
                  setRecipes(updatedRecipes);
                } catch (err) {
                  console.error(
                    "Hiba történt a receptlista frissítésekor",
                    err,
                  );
                }
              }}
            />
          )}
        </aside>
      </div>
    </div>
  );
}
