import { useState, useEffect } from "react";
import AnimatedList from "../components/AnimatedList/AnimatedList";
import BubbleMenu from "../components/BubbleMenu/BubbleMenu";
import RecipeDetails from "../components/RecipeDetails/RecipeDetails";
import LightPillar from "../components/Background/LightPillar";
import NewRecipeForm from "../components/NewRecipeForm/NewRecipeForm";
import AiRecipePanel from "../components/AiRecipePanel/AiRecipePanel";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
  writeBatch,
} from "firebase/firestore";
import { signOut } from "firebase/auth";
import { auth, db } from "../firebase";

import "../components/AnimatedList/AnimatedList.css";
import "../components/BubbleMenu/BubbleMenu.css";
import "./Home.css";

export default function Home({ user }) {
  const [recipes, setRecipes] = useState([]);
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [editingRecipe, setEditingRecipe] = useState(null);
  const [filterTag, setFilterTag] = useState("all");
  const [allTags, setAllTags] = useState([]);
  const [showNewRecipeForm, setShowNewRecipeForm] = useState(false);
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [shoppingList, setShoppingList] = useState([]);
  const [fridge, setFridge] = useState([]);
  const [newShoppingItem, setNewShoppingItem] = useState({
    name: "",
    amount: "",
    unit: "",
  });
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
    if (!user?.uid) return;

    const shopRef = collection(db, "users", user.uid, "shoppingList");
    const fridgeRef = collection(db, "users", user.uid, "fridge");

    const unsubShop = onSnapshot(
      query(shopRef, orderBy("name")),
      (snap) => {
        const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setShoppingList(items);
      },
      (err) => console.error("Hiba a bevásárlólista olvasásakor", err),
    );

    const unsubFridge = onSnapshot(
      query(fridgeRef, orderBy("name")),
      (snap) => {
        const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setFridge(items);
      },
      (err) => console.error("Hiba a hűtő olvasásakor", err),
    );

    return () => {
      unsubShop();
      unsubFridge();
    };
  }, [user?.uid]);

  const createRecipe = async (data) => {
    const recipesRef = collection(db, "users", user.uid, "recipes");
    return addDoc(recipesRef, data);
  };

  const updateRecipe = async (id, data) => {
    return updateDoc(doc(db, "users", user.uid, "recipes", id), data);
  };

  const deleteRecipe = async (id) => {
    return deleteDoc(doc(db, "users", user.uid, "recipes", id));
  };

  const deleteTagGlobally = async (tag) => {
    const affected = recipes.filter((r) => r.tags?.includes(tag));
    if (affected.length === 0) return;

    const batch = writeBatch(db);
    affected.forEach((r) => {
      const nextTags = (r.tags || []).filter((t) => t !== tag);
      batch.update(doc(db, "users", user.uid, "recipes", r.id), {
        tags: nextTags,
      });
    });
    await batch.commit();
  };

  const addToShoppingList = async (ingredients) => {
    if (
      !window.confirm("Biztosan hozzáadod a hozzávalókat a bevásárlólistához?")
    )
      return;

    try {
      const shopRef = collection(db, "users", user.uid, "shoppingList");

      for (const ing of ingredients) {
        const name = (ing?.name || "").toString().trim();
        if (!name) continue;
        const unit = (ing?.unit || "").toString().trim();
        const amount = Number(ing?.amount || 0);
        if (!amount || amount <= 0) continue;

        const existing = shoppingList.find(
          (i) =>
            i.name?.toString().trim() === name &&
            i.unit?.toString().trim() === unit,
        );

        if (existing) {
          const nextAmount = Number(existing.amount || 0) + amount;
          await updateDoc(
            doc(db, "users", user.uid, "shoppingList", existing.id),
            { amount: nextAmount },
          );
        } else {
          await addDoc(shopRef, { name, amount, unit });
        }
      }

      alert("? Sikeresen hozzáadva a bevásárlólistához");
    } catch (err) {
      console.error(err);
      alert("? Hiba történt");
    }
  };

  const updateShoppingItem = async (item, delta) => {
    try {
      const current = Number(item.amount || 0);
      const nextAmount = current + delta;
      if (nextAmount <= 0) return;

      await updateDoc(
        doc(db, "users", user.uid, "shoppingList", item.id),
        { amount: nextAmount },
      );
    } catch (err) {
      console.error(err);
      alert("? Hiba történt");
    }
  };

  const addSingleShoppingItem = async (item) => {
    try {
      const name = (item?.name || "").toString().trim();
      const unit = (item?.unit || "").toString().trim();
      const amount = Number(item?.amount || 0);
      if (!name || amount <= 0) return;

      const existing = shoppingList.find(
        (i) =>
          i.name?.toString().trim() === name &&
          i.unit?.toString().trim() === unit,
      );

      if (existing) {
        const nextAmount = Number(existing.amount || 0) + amount;
        await updateDoc(
          doc(db, "users", user.uid, "shoppingList", existing.id),
          { amount: nextAmount },
        );
      } else {
        const shopRef = collection(db, "users", user.uid, "shoppingList");
        await addDoc(shopRef, { name, amount, unit });
      }
    } catch (err) {
      console.error(err);
      alert("? Hiba történt");
    }
  };

  const moveShoppingToFridge = async () => {
    if (shoppingList.length === 0) return;
    if (!window.confirm("Biztos, hogy megvetted a lista termékeit?")) return;

    try {
      const fridgeRef = collection(db, "users", user.uid, "fridge");

      await Promise.all(
        shoppingList.map(async (item) => {
          const name = (item?.name || "").toString().trim();
          const unit = (item?.unit || "").toString().trim();
          const amount = Number(item?.amount || 0);
          if (!name || amount <= 0) return;

          const existing = fridge.find(
            (i) =>
              i.name?.toString().trim() === name &&
              i.unit?.toString().trim() === unit,
          );

          if (existing) {
            const nextAmount = Number(existing.amount || 0) + amount;
            await updateDoc(
              doc(db, "users", user.uid, "fridge", existing.id),
              { amount: nextAmount },
            );
          } else {
            await addDoc(fridgeRef, { name, amount, unit });
          }

          await deleteDoc(
            doc(db, "users", user.uid, "shoppingList", item.id),
          );
        }),
      );
    } catch (err) {
      console.error(err);
      alert("? Hiba történt");
    }
  };

  const addToFridge = async (item, delta) => {
    try {
      const name = (item?.name || "").toString().trim();
      const unit = (item?.unit || "").toString().trim();
      const amount = Number(item?.amount || 0);
      const change = Number(delta || 0);
      if (!name) return;

      const existing = fridge.find(
        (i) =>
          i.name?.toString().trim() === name &&
          i.unit?.toString().trim() === unit,
      );

      if (existing) {
        const nextAmount =
          Number(existing.amount || 0) + (change !== 0 ? change : amount);
        if (nextAmount <= 0) return;
        await updateDoc(doc(db, "users", user.uid, "fridge", existing.id), {
          amount: nextAmount,
        });
      } else {
        if (amount <= 0) return;
        const fridgeRef = collection(db, "users", user.uid, "fridge");
        await addDoc(fridgeRef, { name, amount, unit });
      }
    } catch (err) {
      console.error(err);
      alert("? Hiba a hűtő frissítésekor");
    }
  };

  useEffect(() => {
    if (!user?.uid) return;

    const recipesRef = collection(db, "users", user.uid, "recipes");
    const unsub = onSnapshot(
      query(recipesRef, orderBy("name")),
      (snap) => {
        const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setRecipes(items);
      },
      (err) => console.error("Hiba a receptek olvasásakor", err),
    );

    return () => unsub();
  }, [user?.uid]);

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
          <h3>Menü</h3>
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
              onAddTag={(tag) =>
                setAllTags((prev) =>
                  prev.includes(tag) ? prev : [...prev, tag],
                )
              }
              onDeleteTag={deleteTagGlobally}
              onSave={async (updated) => {
                const { id, ...data } = updated;
                await updateRecipe(id, data);
                setEditingRecipe(null);
                setSelectedRecipe((prev) =>
                  prev?.id === id ? { ...prev, ...data, id } : prev,
                );
              }}
            />
          ) : selectedRecipe ? (
            <RecipeDetails
              recipe={selectedRecipe}
              onDelete={async (id) => {
                await deleteRecipe(id);
                setSelectedRecipe(null);
              }}
              onEdit={() => setEditingRecipe(selectedRecipe)}
              onAddToShoppingList={addToShoppingList}
            />
          ) : (
            <div className="recipe-details">Kattints egy meglévő receptre, vagy adj hozzá újat a listához.</div>
          )}

          {/* <div className="lists-column"></div> */}
        </main>

        <div className="shopping-list">
          <h3>Bevásárlólista</h3>
          {shoppingList.length === 0 ? (
            <p>Üres</p>
          ) : (
            <ul>
              {shoppingList.map((item, i) => (
                <li key={item.id}>
                  <span style={{ flex: 1 }}>
                    {item.name} - {item.amount} {item.unit}
                  </span>
                  <div className="item-actions">
                    <button
                      style={smallBtn}
                      onClick={() => updateShoppingItem(item, 1)}
                    >
                      +
                    </button>

                    <button
                      style={smallBtn}
                      disabled={item.amount <= 1}
                      onClick={() => updateShoppingItem(item, -1)}
                    >
                      -
                    </button>

                    <button
                      style={smallBtn}
                       onClick={async () => {
                        if (!window.confirm("Biztosan törlöd?")) return;
                        await deleteDoc(
                          doc(db, "users", user.uid, "shoppingList", item.id),
                        );
                      }}
                    >
                      Törlés
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="shopping-add">
            <input
              style={{ width: "80px" }}
              placeholder="név"
              value={newShoppingItem.name}
              onChange={(e) =>
                setNewShoppingItem((p) => ({ ...p, name: e.target.value }))
              }
            />

            <input
              style={{ width: "50px" }}
              type="number"
              min="0"
              step="1"
              placeholder="menny."
              value={newShoppingItem.amount}
              onChange={(e) => {
                const val = Math.max(0, Number(e.target.value));
                setNewShoppingItem((p) => ({ ...p, amount: val }));
              }}
            />

            <select
              value={newShoppingItem.unit}
              onChange={(e) =>
                setNewShoppingItem((p) => ({ ...p, unit: e.target.value }))
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
                if (!newShoppingItem.name || !newShoppingItem.amount) return;

                addSingleShoppingItem({
                  name: newShoppingItem.name,
                  amount: Number(newShoppingItem.amount),
                  unit: newShoppingItem.unit || "db",
                });

                setNewShoppingItem({ name: "", amount: "", unit: "" });
              }}
            >
            +
            </button>
          </div>

          <button
            className="shopping-clear"
             onClick={async () => {
              if (!window.confirm("Biztosan törlöd a teljes listát?")) return;
              await Promise.all(
                shoppingList.map((item) =>
                  deleteDoc(
                    doc(db, "users", user.uid, "shoppingList", item.id),
                  ),
                ),
              );
            }}
          >
            Lista törlése
          </button>
          <button className="shopping-move" onClick={moveShoppingToFridge}>
            Hűtőbe rak
          </button>
        </div>

        <div className="fridge">
          <h3>Hűtő</h3>
          {fridge.length === 0 ? (
            <p>Üres</p>
          ) : (
            <ul>
              <div></div>
              {fridge.map((item, i) => (
                <li
                  key={item.id}
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
                    onClick={() => addToFridge(item, 1)}
                  >
                    +
                  </button>

                  <button
                    style={smallBtn}
                    disabled={item.amount <= 1}
                    onClick={() => addToFridge(item, -1)}
                  >
                    -
                  </button>

                  <button
                    style={smallBtn}
                     onClick={async () => {
                      if (!window.confirm("Biztosan törlöd?")) return;
                      await deleteDoc(
                        doc(db, "users", user.uid, "fridge", item.id),
                      );
                    }}
                  >
                    Törlés
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
              Tétel hozzáadása+
            </button>
          </div>
        </div>

        <aside className="right-panel">
          <button onClick={() => setShowNewRecipeForm((prev) => !prev)}>
            Új saját recept hozzáadása
          </button>

          {showNewRecipeForm && (
            <NewRecipeForm
              existingTags={allTags}
              onAddTag={(tag) =>
                setAllTags((prev) =>
                  prev.includes(tag) ? prev : [...prev, tag],
                )
              }
              onDeleteTag={deleteTagGlobally}
              onCreate={async (data) => {
                try {
                  await createRecipe(data);
                  setShowNewRecipeForm(false);
                } catch (err) {
                  console.error(err);
                  alert("Recept mentése sikertelen");
                }
              }}
            />
          )}

          <div><p>vagy</p></div>

          <button onClick={() => setShowAiPanel((prev) => !prev)}>
            AI-recept generálás
          </button>

          {showAiPanel && (
            <AiRecipePanel
              fridgeItems={fridge}
              onSaveRecipe={async (data) => {
                try {
                  await createRecipe(data);
                  setShowAiPanel(false);
                } catch (err) {
                  console.error(err);
                  alert("Recept mentése sikertelen");
                }
              }}
            />
          )}
        </aside>
      </div>
    </div>
  );
}
