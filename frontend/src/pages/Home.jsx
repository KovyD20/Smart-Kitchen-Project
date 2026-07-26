import { useState } from "react";
import BubbleMenu from "../components/BubbleMenu/BubbleMenu";
import LightPillar from "../components/Background/LightPillar";
import RecipeListPanel from "../components/Home/RecipeListPanel";
import RecipeDisplayPanel from "../components/Home/RecipeDisplayPanel";
import ShoppingListPanel from "../components/Home/ShoppingListPanel";
import FridgePanel from "../components/Home/FridgePanel";
import NewRecipePanel from "../components/Home/NewRecipePanel";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";

import "../components/AnimatedList/AnimatedList.css";
import "../components/BubbleMenu/BubbleMenu.css";
import "./Home.css";
import { SYSTEM_UNITS } from "../constants/units";
import { useRecipes } from "../hooks/useRecipes";
import { useInventory } from "../hooks/useInventory";
import { useToast } from "../context/ToastContext";
import { useConfirm } from "../context/ConfirmContext";

export default function Home({ user }) {
  const {
    recipes,
    allTags,
    addTag,
    createRecipe,
    updateRecipe,
    deleteRecipe,
    deleteTagGlobally,
  } = useRecipes(user.uid);

  const {
    shoppingList,
    fridge,
    groupedShoppingList,
    groupedFridge,
    missingRecommendations,
    addToShoppingList,
    addSingleShoppingItem,
    updateShoppingItem,
    deleteShoppingItem,
    clearShoppingList,
    moveShoppingToFridge,
    addToFridge,
    deleteFridgeItem,
  } = useInventory(user.uid);

  const { showToast } = useToast();
  const confirm = useConfirm();

  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [editingRecipe, setEditingRecipe] = useState(null);
  const [filterTag, setFilterTag] = useState("all");
  const [showNewRecipeForm, setShowNewRecipeForm] = useState(false);
  const [showAiPanel, setShowAiPanel] = useState(false);
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

  const notifyError = (err, msg = "Hiba történt") => {
    console.error(err);
    showToast(msg, "error");
  };

  const filteredRecipes = recipes.filter(
    (r) => filterTag === "all" || r.tags?.includes(filterTag),
  );

  const handleAddToShoppingList = async (ingredients) => {
    if (
      !(await confirm("Biztosan hozzáadod a hozzávalókat a bevásárlólistához?"))
    )
      return;
    try {
      await addToShoppingList(ingredients);
      showToast("Sikeresen hozzáadva a bevásárlólistához", "success");
    } catch (err) {
      notifyError(err);
    }
  };

  const handleMoveToFridge = async () => {
    if (shoppingList.length === 0) return;
    if (!(await confirm("Biztos, hogy megvetted a lista termékeit?"))) return;
    try {
      await moveShoppingToFridge();
    } catch (err) {
      notifyError(err);
    }
  };

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
                notifyError(err, "Kijelentkezés sikertelen");
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
          onAddTag={addTag}
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
          onAddToShoppingList={handleAddToShoppingList}
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
            }).catch(notifyError)
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
            }).catch(notifyError);
            setNewShoppingItem({ name: "", amount: "", unit: "" });
          }}
          onUpdateItem={(item, delta) =>
            updateShoppingItem(item, delta).catch(notifyError)
          }
          onDeleteItem={async (item) => {
            if (!(await confirm("Biztosan törlöd?"))) return;
            await deleteShoppingItem(item).catch(notifyError);
          }}
          onClearList={async () => {
            if (!(await confirm("Biztosan törlöd a teljes listát?"))) return;
            await clearShoppingList().catch(notifyError);
          }}
          onMoveToFridge={handleMoveToFridge}
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
            }).catch((err) => notifyError(err, "Hiba a hűtő frissítésekor"));
            setNewFridgeItem({ name: "", amount: "", unit: "" });
          }}
          onUpdateItem={(item, delta) =>
            addToFridge(item, delta).catch((err) =>
              notifyError(err, "Hiba a hűtő frissítésekor"),
            )
          }
          onDeleteItem={async (item) => {
            if (!(await confirm("Biztosan törlöd?"))) return;
            await deleteFridgeItem(item).catch(notifyError);
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
          onAddTag={addTag}
          onDeleteTag={deleteTagGlobally}
          onCreateRecipe={async (data) => {
            try {
              await createRecipe(data);
              setShowNewRecipeForm(false);
            } catch (err) {
              notifyError(err, "Recept mentése sikertelen");
            }
          }}
          onSaveAiRecipe={async (data) => {
            try {
              await createRecipe(data);
              setShowAiPanel(false);
            } catch (err) {
              notifyError(err, "Recept mentése sikertelen");
            }
          }}
        />
      </div>
    </div>
  );
}
