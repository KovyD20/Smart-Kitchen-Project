import { useState, useEffect, useMemo } from "react";
import BubbleMenu from "../components/BubbleMenu/BubbleMenu";
import LightPillar from "../components/Background/LightPillar";
import RecipeListPanel from "../components/Home/RecipeListPanel";
import RecipeDisplayPanel from "../components/Home/RecipeDisplayPanel";
import ShoppingListPanel from "../components/Home/ShoppingListPanel";
import FridgePanel from "../components/Home/FridgePanel";
import NewRecipePanel from "../components/Home/NewRecipePanel";
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
import { SYSTEM_UNITS, UNIT_ALIASES } from "../constants/units";
import { useCatalog } from "../context/CatalogContext";

export default function Home({ user }) {
  const {
    getMissingCatalogRecommendations,
    groupItemsByCatalog,
    resolveCanonicalCatalogName,
    resolveCatalogKey,
  } = useCatalog();
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
  const smallBtn = {
    padding: "3px 6px",
    fontSize: "15px",
    lineHeight: "1",
  };
  const UNITS = SYSTEM_UNITS;

  const escapeRegex = (value) =>
    value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const UNIT_TOKENS = Array.from(
    new Set([...SYSTEM_UNITS, ...Object.keys(UNIT_ALIASES)]),
  ).sort((a, b) => b.length - a.length);

  const UNIT_TOKEN_PATTERN = UNIT_TOKENS.map(escapeRegex).join("|");

  const normalizeName = (value) => {
    const base = (value || "").toString().trim().toLocaleLowerCase("hu-HU");
    const ascii = base.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const unitRegex = UNIT_TOKEN_PATTERN
      ? new RegExp(
          `(\\d+([.,]\\d+)?)(\\s*)(${UNIT_TOKEN_PATTERN})\\b`,
          "g",
        )
      : null;

    const withoutNumbers = ascii
      .replace(unitRegex || /$^/, " ")
      .replace(/\b\d+([.,]\d+)?\b/g, " ")
      .replace(/[()\-_,.;:!+]/g, " ");

    const cleaned = withoutNumbers.replace(/\s+/g, " ").trim();
    return resolveCatalogKey(cleaned);
  };

  const canonicalizeName = (value) => {
    const raw = (value || "").toString().trim();
    if (!raw) return "";
    const key = normalizeName(raw);
    return resolveCanonicalCatalogName(key || raw);
  };

  const normalizeUnit = (value) => {
    const raw = (value || "").toString().trim().toLocaleLowerCase("hu-HU");
    if (!raw) return "";
    const ascii = raw.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const cleaned = ascii.replace(/\./g, "").replace(/[\s-]+/g, "").trim();
    return UNIT_ALIASES[cleaned] || cleaned;
  };
  const unitInfo = (unit) => {
    const u = normalizeUnit(unit);
    const table = {
      g: { kind: "mass", factor: 1 },
      dkg: { kind: "mass", factor: 10 },
      kg: { kind: "mass", factor: 1000 },
      ml: { kind: "volume", factor: 1 },
      dl: { kind: "volume", factor: 100 },
      l: { kind: "volume", factor: 1000 },
      db: { kind: "count", factor: 1 },
    };
    return { unit: u, ...table[u] };
  };
  const areUnitsCompatible = (a, b) => {
    if (!a || !b) return false;
    if (a.unit === b.unit) return true;
    if (!a.kind || !b.kind) return false;
    return a.kind === b.kind && (a.kind === "mass" || a.kind === "volume");
  };
  const convertAmount = (amount, fromInfo, toInfo) => {
    if (!fromInfo || !toInfo) return amount;
    if (fromInfo.unit === toInfo.unit) return amount;
    if (!areUnitsCompatible(fromInfo, toInfo)) return amount;
    return (Number(amount) || 0) * (fromInfo.factor / toInfo.factor);
  };

  const groupedShoppingList = useMemo(
    () => groupItemsByCatalog(shoppingList),
    [shoppingList, groupItemsByCatalog],
  );

  const groupedFridge = useMemo(
    () => groupItemsByCatalog(fridge),
    [fridge, groupItemsByCatalog],
  );

  const missingRecommendations = useMemo(
    () => getMissingCatalogRecommendations(fridge, shoppingList),
    [fridge, shoppingList, getMissingCatalogRecommendations],
  );

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
        const rawName = (ing?.name || "").toString().trim();
        if (!rawName) continue;
        const canonicalName = canonicalizeName(rawName);
        const nameKey = normalizeName(canonicalName);
        const unit = normalizeUnit(ing?.unit);
        const incomingUnitInfo = unitInfo(unit);
        const amount = Number(ing?.amount || 0);
        if (!amount || amount <= 0) continue;

        const existing = shoppingList.find((i) => {
          if (normalizeName(i.name) !== nameKey) return false;
          const existingInfo = unitInfo(i.unit);
          return areUnitsCompatible(existingInfo, incomingUnitInfo);
        });

        if (existing) {
          const existingInfo = unitInfo(existing.unit);
          const converted = convertAmount(
            amount,
            incomingUnitInfo,
            existingInfo,
          );
          const nextAmount = Number(existing.amount || 0) + converted;
          await updateDoc(
            doc(db, "users", user.uid, "shoppingList", existing.id),
            { amount: nextAmount, name: canonicalName },
          );
        } else {
          await addDoc(shopRef, { name: canonicalName, amount, unit });
        }
      }

      alert("✅ Sikeresen hozzáadva a bevásárlólistához");
    } catch (err) {
      console.error(err);
      alert("❌ Hiba történt");
    }
  };

  const updateShoppingItem = async (item, delta) => {
    try {
      const current = Number(item.amount || 0);
      const nextAmount = current + delta;
      if (nextAmount <= 0) return;
      const canonicalName = canonicalizeName(item?.name);

      await updateDoc(doc(db, "users", user.uid, "shoppingList", item.id), {
        amount: nextAmount,
        name: canonicalName || item?.name,
      });
    } catch (err) {
      console.error(err);
      alert("❌ Hiba történt");
    }
  };

  const addSingleShoppingItem = async (item) => {
    try {
      const rawName = (item?.name || "").toString().trim();
      const canonicalName = canonicalizeName(rawName);
      const unit = normalizeUnit(item?.unit);
      const incomingUnitInfo = unitInfo(unit);
      const amount = Number(item?.amount || 0);
      if (!rawName || amount <= 0) return;
      const nameKey = normalizeName(canonicalName);

      const existing = shoppingList.find((i) => {
        if (normalizeName(i.name) !== nameKey) return false;
        const existingInfo = unitInfo(i.unit);
        return areUnitsCompatible(existingInfo, incomingUnitInfo);
      });

      if (existing) {
        const existingInfo = unitInfo(existing.unit);
        const converted = convertAmount(amount, incomingUnitInfo, existingInfo);
        const nextAmount = Number(existing.amount || 0) + converted;
        await updateDoc(
          doc(db, "users", user.uid, "shoppingList", existing.id),
          { amount: nextAmount, name: canonicalName },
        );
      } else {
        const shopRef = collection(db, "users", user.uid, "shoppingList");
        await addDoc(shopRef, { name: canonicalName, amount, unit });
      }
    } catch (err) {
      console.error(err);
      alert("❌ Hiba történt");
    }
  };

  const moveShoppingToFridge = async () => {
    if (shoppingList.length === 0) return;
    if (!window.confirm("Biztos, hogy megvetted a lista termékeit?")) return;

    try {
      const fridgeRef = collection(db, "users", user.uid, "fridge");

      await Promise.all(
        shoppingList.map(async (item) => {
          const rawName = (item?.name || "").toString().trim();
          const canonicalName = canonicalizeName(rawName);
          const unit = normalizeUnit(item?.unit);
          const incomingUnitInfo = unitInfo(unit);
          const amount = Number(item?.amount || 0);
          if (!rawName || amount <= 0) return;
          const nameKey = normalizeName(canonicalName);

          const existing = fridge.find((i) => {
            if (normalizeName(i.name) !== nameKey) return false;
            const existingInfo = unitInfo(i.unit);
            return areUnitsCompatible(existingInfo, incomingUnitInfo);
          });

          if (existing) {
            const existingInfo = unitInfo(existing.unit);
            const converted = convertAmount(
              amount,
              incomingUnitInfo,
              existingInfo,
            );
            const nextAmount = Number(existing.amount || 0) + converted;
            await updateDoc(doc(db, "users", user.uid, "fridge", existing.id), {
              amount: nextAmount,
              name: canonicalName,
            });
          } else {
            await addDoc(fridgeRef, { name: canonicalName, amount, unit });
          }

          await deleteDoc(doc(db, "users", user.uid, "shoppingList", item.id));
        }),
      );
    } catch (err) {
      console.error(err);
      alert("❌ Hiba történt");
    }
  };

  const addToFridge = async (item, delta) => {
    try {
      const rawName = (item?.name || "").toString().trim();
      const canonicalName = canonicalizeName(rawName);
      const unit = normalizeUnit(item?.unit);
      const incomingUnitInfo = unitInfo(unit);
      const amount = Number(item?.amount || 0);
      const change = Number(delta || 0);
      if (!rawName) return;
      const nameKey = normalizeName(canonicalName);

      const existing = fridge.find((i) => {
        if (normalizeName(i.name) !== nameKey) return false;
        const existingInfo = unitInfo(i.unit);
        return areUnitsCompatible(existingInfo, incomingUnitInfo);
      });

      if (existing) {
        const existingInfo = unitInfo(existing.unit);
        const incomingAmount = change !== 0 ? change : amount;
        const converted = convertAmount(
          incomingAmount,
          incomingUnitInfo,
          existingInfo,
        );
        const nextAmount = Number(existing.amount || 0) + converted;
        if (nextAmount <= 0) return;
        await updateDoc(doc(db, "users", user.uid, "fridge", existing.id), {
          amount: nextAmount,
          name: canonicalName,
        });
      } else {
        if (amount <= 0) return;
        const fridgeRef = collection(db, "users", user.uid, "fridge");
        await addDoc(fridgeRef, { name: canonicalName, amount, unit });
      }
    } catch (err) {
      console.error(err);
      alert("❌ Hiba a hűtő frissítésekor");
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
        const tags = new Set();
        items.forEach((item) => item.tags?.forEach((tag) => tags.add(tag)));
        setAllTags([...tags]);
      },
      (err) => console.error("Hiba a receptek olvasásakor", err),
    );

    return () => unsub();
  }, [user?.uid]);

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

      <div className="home-header">
        <div className="home-nav" aria-label="Fő menü">
          <BubbleMenu
            className="home-bubble-menu"
            logo={<span style={{ fontWeight: 700 }}>RECEPTOR</span>}
            items={menuItems}
            menuBg="#8a0f0f"
            menuContentColor="#000"
            useFixedPosition={false}
          />
        </div>
        <h1 className="home-title">Recept Operációs Rendszer</h1>
        <div className="home-user">
          <span className="home-email">
            {user?.email || "Ismeretlen email"}
          </span>
          <button
            className="home-logout"
            onClick={async () => {
              try {
                await signOut(auth);
              } catch (err) {
                console.error(err);
                alert("Kijelentkezés sikertelen");
              }
            }}
          >
            Kijelentkezés
          </button>
        </div>
      </div>

      <div className="home-layout">
        <RecipeListPanel
          filterTag={filterTag}
          allTags={allTags}
          filteredRecipes={filteredRecipes}
          onFilterChange={setFilterTag}
          onSelectRecipe={(item) =>
            setSelectedRecipe(recipes.find((r) => r.id === item.id))
          }
        />

        <RecipeDisplayPanel
          editingRecipe={editingRecipe}
          selectedRecipe={selectedRecipe}
          allTags={allTags}
          onAddTag={(tag) =>
            setAllTags((prev) => (prev.includes(tag) ? prev : [...prev, tag]))
          }
          onDeleteTag={deleteTagGlobally}
          onSaveEdit={async (updated) => {
            const { id, ...data } = updated;
            await updateRecipe(id, data);
            setEditingRecipe(null);
            setSelectedRecipe((prev) =>
              prev?.id === id ? { ...prev, ...data, id } : prev,
            );
          }}
          onDeleteRecipe={async (id) => {
            await deleteRecipe(id);
            setSelectedRecipe(null);
          }}
          onEditRecipe={() => setEditingRecipe(selectedRecipe)}
          onAddToShoppingList={addToShoppingList}
        />

        <ShoppingListPanel
          shoppingList={shoppingList}
          groupedShoppingList={groupedShoppingList}
          newShoppingItem={newShoppingItem}
          units={UNITS}
          missingEssentialItems={missingRecommendations.essential}
          recommendedGoodToHaveItems={missingRecommendations.goodToHave}
          recommendedExtraItems={missingRecommendations.extra}
          onAddRecommendedEssentialItem={(item) =>
            addSingleShoppingItem({
              name: item?.name || "",
              amount: 1,
              unit: "db",
            })
          }
          onChangeNewItem={(field, value) =>
            setNewShoppingItem((p) => ({ ...p, [field]: value }))
          }
          onAddNewItem={() => {
            if (!newShoppingItem.name || !newShoppingItem.amount) return;

            addSingleShoppingItem({
              name: newShoppingItem.name,
              amount: Number(newShoppingItem.amount),
              unit: newShoppingItem.unit || "db",
            });

            setNewShoppingItem({ name: "", amount: "", unit: "" });
          }}
          onUpdateItem={updateShoppingItem}
          onDeleteItem={async (item) => {
            if (!window.confirm("Biztosan törlöd?")) return;
            await deleteDoc(
              doc(db, "users", user.uid, "shoppingList", item.id),
            );
          }}
          onClearList={async () => {
            if (!window.confirm("Biztosan törlöd a teljes listát?")) return;
            await Promise.all(
              shoppingList.map((item) =>
                deleteDoc(doc(db, "users", user.uid, "shoppingList", item.id)),
              ),
            );
          }}
          onMoveToFridge={moveShoppingToFridge}
          smallBtn={smallBtn}
        />

        <FridgePanel
          fridge={fridge}
          groupedFridge={groupedFridge}
          newFridgeItem={newFridgeItem}
          units={UNITS}
          onChangeNewItem={(field, value) =>
            setNewFridgeItem((p) => ({ ...p, [field]: value }))
          }
          onAddNewItem={() => {
            if (!newFridgeItem.name || !newFridgeItem.amount) return;

            addToFridge({
              name: newFridgeItem.name,
              amount: Number(newFridgeItem.amount),
              unit: newFridgeItem.unit || "db",
            });

            setNewFridgeItem({ name: "", amount: "", unit: "" });
          }}
          onUpdateItem={addToFridge}
          onDeleteItem={async (item) => {
            if (!window.confirm("Biztosan törlöd?")) return;
            await deleteDoc(doc(db, "users", user.uid, "fridge", item.id));
          }}
          smallBtn={smallBtn}
        />

        <NewRecipePanel
          showNewRecipeForm={showNewRecipeForm}
          showAiPanel={showAiPanel}
          allTags={allTags}
          fridge={fridge}
          onToggleNewRecipeForm={() => setShowNewRecipeForm((prev) => !prev)}
          onToggleAiPanel={() => setShowAiPanel((prev) => !prev)}
          onAddTag={(tag) =>
            setAllTags((prev) => (prev.includes(tag) ? prev : [...prev, tag]))
          }
          onDeleteTag={deleteTagGlobally}
          onCreateRecipe={async (data) => {
            try {
              await createRecipe(data);
              setShowNewRecipeForm(false);
            } catch (err) {
              console.error(err);
              alert("Recept mentése sikertelen");
            }
          }}
          onSaveAiRecipe={async (data) => {
            try {
              await createRecipe(data);
              setShowAiPanel(false);
            } catch (err) {
              console.error(err);
              alert("Recept mentése sikertelen");
            }
          }}
        />
      </div>
    </div>
  );
}

