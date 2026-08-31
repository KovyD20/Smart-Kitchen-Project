import { useEffect, useMemo, useRef, useState } from "react";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";

import LightPillar from "../components/Background/LightPillar";
import Icon from "../components/Icon/Icon";
import RecipesView from "../components/views/RecipesView";
import RecipeView from "../components/views/RecipeView";
import ShoppingView from "../components/views/ShoppingView";
import FridgeView from "../components/views/FridgeView";
import NewRecipeView from "../components/views/NewRecipeView";
import CookMode from "../components/views/CookMode";
import NewRecipeForm from "../components/NewRecipeForm/NewRecipeForm";
import LoadingBanner from "../components/LoadingBanner/LoadingBanner";

import "./Home.css";
import { SYSTEM_UNITS } from "../constants/units";
import { useRecipes } from "../hooks/useRecipes";
import { useInventory } from "../hooks/useInventory";
import { useIsMobile } from "../hooks/useIsMobile";
import { useCategoryColors } from "../hooks/useCategoryColors";
import { useCatalog } from "../context/CatalogContext";
import { useToast } from "../context/ToastContext";
import { useConfirm } from "../context/ConfirmContext";
import {
  filterRecipes,
  itemMatchesSearch,
  recipeServings,
  scaleIngredients,
  sortByAvailability,
  sortByCourse,
} from "../lib/recipes";

// The five destinations of the redesign. Order and accent color are shared by the
// desktop top bar and the mobile bottom bar.
const TABS = [
  {
    id: "receptek",
    label: "Receptek",
    shortLabel: "Receptek",
    icon: "book",
    accent: "var(--brand-bright)",
  },
  {
    id: "recept",
    label: "Recept",
    shortLabel: "Recept",
    icon: "utensils",
    accent: "var(--orange)",
  },
  {
    id: "lista",
    label: "Bevásárlólista",
    shortLabel: "Lista",
    icon: "cart",
    accent: "var(--yellow)",
  },
  {
    id: "huto",
    label: "Hűtő",
    shortLabel: "Hűtő",
    icon: "snowflake",
    accent: "var(--blue)",
  },
  {
    id: "uj",
    label: "Új recept",
    shortLabel: "Új",
    icon: "wand",
    accent: "var(--brand-bright)",
  },
];

// The header search narrows the inventory views too, so one field covers
// "receptek, hozzávalók, hűtő" as the design's placeholder promises.
function filterGroups(groups, search) {
  if (!search) return groups;
  return groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => itemMatchesSearch(item, search)),
    }))
    .filter((group) => group.items.length > 0);
}

const SCREEN_TITLES = {
  receptek: "Receptek",
  recept: "Recept",
  lista: "Bevásárlólista",
  huto: "Hűtő",
  uj: "Új recept",
};

export default function Home({ user }) {
  const {
    recipes,
    allTags,
    recipesLoading,
    addTag,
    createRecipe,
    updateRecipe,
    deleteRecipe,
    toggleFavorite,
    deleteTagGlobally,
  } = useRecipes(user.uid);

  const {
    shoppingList,
    fridge,
    inventoryLoading,
    groupedShoppingList,
    groupedFridge,
    missingRecommendations,
    addToShoppingList,
    addSingleShoppingItem,
    updateShoppingItem,
    setShoppingItemAmount,
    setFridgeItemAmount,
    toggleShoppingItemDone,
    deleteShoppingItem,
    clearDoneShoppingItems,
    clearShoppingList,
    moveShoppingToFridge,
    addToFridge,
    deleteFridgeItem,
  } = useInventory(user.uid);

  const {
    resolveCatalogKey,
    ready: catalogReady,
    loading: catalogLoading,
    error: catalogError,
    reload: reloadCatalog,
  } = useCatalog();
  const { showToast } = useToast();
  const confirm = useConfirm();
  const isMobile = useIsMobile();
  // One setting, two views: the shopping list and the fridge colour the same
  // category the same way.
  const {
    colorFor: categoryColorFor,
    isCustom: isCustomCategoryColor,
    setColor: setCategoryColor,
    resetColor: resetCategoryColor,
  } = useCategoryColors(user.uid);

  const [tab, setTab] = useState("receptek");
  const [selectedId, setSelectedId] = useState(null);
  const [editingRecipe, setEditingRecipe] = useState(null);
  const [showManualForm, setShowManualForm] = useState(false);
  const [filterTag, setFilterTag] = useState("all");
  // "name" | "availability". Recipes arrive ordered by name from Firestore, so
  // only "availability" needs sorting here.
  const [sortMode, setSortMode] = useState("name");
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [servingsFor, setServingsFor] = useState({});
  const [cooking, setCooking] = useState(false);
  const [cookStep, setCookStep] = useState(0);
  const searchInputRef = useRef(null);
  const loadedToastShown = useRef(false);

  // The catalog comes from the Render backend (which sleeps), the other two from
  // Firestore listeners. Any of them still pending means the content below is
  // incomplete, so they drive one shared banner.
  const dataLoading = catalogLoading || recipesLoading || inventoryLoading;

  // Confirm the end of the wait once, the first time everything is actually in.
  // The banner disappearing is the main signal; this is the explicit one.
  useEffect(() => {
    if (loadedToastShown.current) return;
    if (!catalogReady || dataLoading) return;
    loadedToastShown.current = true;
    showToast("Adatok betöltve", "success");
  }, [catalogReady, dataLoading, showToast]);

  const notifyError = (err, msg = "Hiba történt") => {
    console.error(err);
    showToast(msg, "error");
  };

  const selectedRecipe = useMemo(
    () => recipes.find((r) => r.id === selectedId) || null,
    [recipes, selectedId],
  );

  // A recipe's own serving count is the baseline its ingredient amounts refer to;
  // a per-recipe override keeps each recipe's chosen scale while browsing.
  const baseServings = recipeServings(selectedRecipe);
  const servings = servingsFor[selectedId] ?? baseServings;
  const setServings = (next) =>
    setServingsFor((prev) => ({ ...prev, [selectedId]: next }));

  const scaledIngredients = useMemo(
    () => scaleIngredients(selectedRecipe?.ingredients, servings, baseServings),
    [selectedRecipe, servings, baseServings],
  );

  const steps = selectedRecipe?.steps || [];

  const visibleRecipes = useMemo(() => {
    const filtered = filterRecipes(recipes, { filterTag, search });
    if (sortMode === "course") return sortByCourse(filtered);
    if (sortMode !== "availability") return filtered;
    // fridge and resolveCatalogKey belong in the deps: without them the order
    // would go stale the moment something is added to or removed from the fridge.
    return sortByAvailability(filtered, fridge, resolveCatalogKey);
  }, [recipes, filterTag, search, sortMode, fridge, resolveCatalogKey]);

  const visibleShoppingGroups = useMemo(
    () => filterGroups(groupedShoppingList, search),
    [groupedShoppingList, search],
  );

  const visibleFridgeGroups = useMemo(
    () => filterGroups(groupedFridge, search),
    [groupedFridge, search],
  );

  const doneCount = shoppingList.filter((item) => item.done).length;
  const openCount = shoppingList.length - doneCount;

  const goToTab = (next) => {
    setTab(next);
    setSearchOpen(false);
  };

  const openRecipe = (recipe) => {
    setSelectedId(recipe.id);
    setEditingRecipe(null);
    setCookStep(0);
    goToTab("recept");
  };

  const badgeFor = (id) => (id === "lista" && openCount > 0 ? openCount : null);

  const handleAddIngredients = async (ingredients, message) => {
    try {
      await addToShoppingList(ingredients);
      showToast(message, "success");
    } catch (err) {
      notifyError(err);
    }
  };

  const handleCategoryColorChange = async (category, hex) => {
    try {
      await setCategoryColor(category, hex);
    } catch (err) {
      notifyError(err, "A szín mentése sikertelen");
    }
  };

  const handleCategoryColorReset = async (category) => {
    try {
      await resetCategoryColor(category);
    } catch (err) {
      notifyError(err, "A szín visszaállítása sikertelen");
    }
  };

  const handleToggleFavorite = async (recipe) => {
    if (!recipe) return;
    try {
      await toggleFavorite(recipe);
    } catch (err) {
      notifyError(err, "Kedvenc jelölés sikertelen");
    }
  };

  const handleDeleteRecipe = async () => {
    if (!selectedRecipe) return;
    if (
      !(await confirm(`Biztosan törlöd a "${selectedRecipe.name}" receptet?`, {
        danger: true,
        confirmLabel: "Törlés",
      }))
    )
      return;
    try {
      await deleteRecipe(selectedRecipe.id);
      setSelectedId(null);
      goToTab("receptek");
    } catch (err) {
      notifyError(err, "Recept törlése sikertelen");
    }
  };

  const handleMoveToFridge = async () => {
    if (shoppingList.length === 0) return;
    if (!(await confirm("Biztos, hogy megvetted a lista termékeit?"))) return;
    try {
      await moveShoppingToFridge();
      showToast("A lista átkerült a hűtőbe", "success");
    } catch (err) {
      notifyError(err);
    }
  };

  const handleClearDone = async () => {
    if (doneCount === 0) return;
    if (
      !(await confirm("Biztosan törlöd a kész tételeket?", {
        danger: true,
        confirmLabel: "Törlés",
      }))
    )
      return;
    try {
      await clearDoneShoppingItems();
    } catch (err) {
      notifyError(err);
    }
  };

  // The one action in the app that discards a lot of data in a single click, and
  // the list is often collapsed into cards -- so the confirmation names the count
  // rather than asking a vague "are you sure?".
  const handleClearAll = async () => {
    if (shoppingList.length === 0) return;
    if (
      !(await confirm(
        `Biztosan törlöd mind a ${shoppingList.length} tételt a listáról?`,
        { danger: true, confirmLabel: "Lista ürítése" },
      ))
    )
      return;
    try {
      await clearShoppingList();
      showToast("A bevásárlólista kiürítve", "success");
    } catch (err) {
      notifyError(err, "A lista ürítése sikertelen");
    }
  };

  const focusSearch = () => {
    if (tab === "receptek") {
      searchInputRef.current?.focus();
      return;
    }
    setSearchOpen((prev) => !prev);
  };

  const renderTab = () => {
    if (tab === "receptek") {
      return (
        <RecipesView
          recipes={visibleRecipes}
          totalCount={recipes.length}
          selectedId={selectedId}
          filterTag={filterTag}
          allTags={allTags}
          search={search}
          isMobile={isMobile}
          searchInputRef={searchInputRef}
          sortMode={sortMode}
          fridge={fridge}
          resolveCatalogKey={resolveCatalogKey}
          onSortChange={setSortMode}
          onFilterChange={setFilterTag}
          onSearchChange={setSearch}
          onSelectRecipe={openRecipe}
        />
      );
    }

    if (tab === "recept") {
      if (editingRecipe) {
        return (
          <div className="form-view">
            <div className="form-shell" style={{ "--accent": "var(--orange)" }}>
              <header className="form-shell-head">
                <span className="panel-title">Recept szerkesztése</span>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label="Szerkesztés bezárása"
                  onClick={() => setEditingRecipe(null)}
                >
                  <Icon name="xmark" size={14} />
                </button>
              </header>
              <NewRecipeForm
                editMode
                recipe={editingRecipe}
                existingTags={allTags}
                onAddTag={addTag}
                onDeleteTag={deleteTagGlobally}
                onSave={async ({ id, ...data }, imageOpts) => {
                  try {
                    await updateRecipe(id, data, imageOpts);
                    setEditingRecipe(null);
                    showToast("Recept frissítve", "success");
                  } catch (err) {
                    notifyError(
                      err,
                      err?.stage === "image"
                        ? "A recept mentve, de a kép feltöltése nem sikerült"
                        : "Recept mentése sikertelen",
                    );
                  }
                }}
              />
            </div>
          </div>
        );
      }

      return (
        <RecipeView
          recipe={selectedRecipe}
          ingredients={scaledIngredients}
          steps={steps}
          fridge={fridge}
          resolveCatalogKey={resolveCatalogKey}
          servings={servings}
          isMobile={isMobile}
          onServingsChange={setServings}
          onStartCook={() => {
            setCookStep(0);
            setCooking(true);
          }}
          onAddIngredient={(ingredient) =>
            handleAddIngredients(
              [ingredient],
              `${ingredient.name} a bevásárlólistán`,
            )
          }
          onAddAllToCart={() =>
            handleAddIngredients(
              scaledIngredients,
              "A hozzávalók a bevásárlólistán",
            )
          }
          onAddMissingToCart={(missing) =>
            handleAddIngredients(missing, "A hiányzók a bevásárlólistán")
          }
          onToggleFavorite={() => handleToggleFavorite(selectedRecipe)}
          onEdit={() => setEditingRecipe(selectedRecipe)}
          onDelete={handleDeleteRecipe}
          onGoToRecipes={() => goToTab("receptek")}
        />
      );
    }

    if (tab === "lista") {
      return (
        <ShoppingView
          groups={visibleShoppingGroups}
          openCount={openCount}
          doneCount={doneCount}
          units={SYSTEM_UNITS}
          recommendations={missingRecommendations}
          isMobile={isMobile}
          colorFor={categoryColorFor}
          isCustomColor={isCustomCategoryColor}
          onCategoryColorChange={handleCategoryColorChange}
          onCategoryColorReset={handleCategoryColorReset}
          onToggleDone={(item) =>
            toggleShoppingItemDone(item).catch(notifyError)
          }
          onUpdateItem={(item, delta) =>
            updateShoppingItem(item, delta).catch(notifyError)
          }
          onSetItemAmount={(item, patch) =>
            setShoppingItemAmount(item, patch).catch(notifyError)
          }
          onDeleteItem={async (item) => {
            if (
              !(await confirm("Biztosan törlöd?", {
                danger: true,
                confirmLabel: "Törlés",
              }))
            )
              return;
            await deleteShoppingItem(item).catch(notifyError);
          }}
          onAddItem={(item) => addSingleShoppingItem(item).catch(notifyError)}
          onClearDone={handleClearDone}
          onClearAll={handleClearAll}
          onMoveToFridge={handleMoveToFridge}
        />
      );
    }

    if (tab === "huto") {
      return (
        <FridgeView
          groups={visibleFridgeGroups}
          itemCount={fridge.length}
          units={SYSTEM_UNITS}
          isMobile={isMobile}
          colorFor={categoryColorFor}
          isCustomColor={isCustomCategoryColor}
          onCategoryColorChange={handleCategoryColorChange}
          onCategoryColorReset={handleCategoryColorReset}
          onUpdateItem={(item, delta) =>
            addToFridge(item, delta).catch((err) =>
              notifyError(err, "Hiba a hűtő frissítésekor"),
            )
          }
          onSetItemAmount={(item, patch) =>
            setFridgeItemAmount(item, patch).catch((err) =>
              notifyError(err, "Hiba a hűtő frissítésekor"),
            )
          }
          onDeleteItem={async (item) => {
            if (
              !(await confirm("Biztosan törlöd?", {
                danger: true,
                confirmLabel: "Törlés",
              }))
            )
              return;
            await deleteFridgeItem(item).catch(notifyError);
          }}
          onAddItem={(item) =>
            addToFridge(item).catch((err) =>
              notifyError(err, "Hiba a hűtő frissítésekor"),
            )
          }
          onGoToNew={() => goToTab("uj")}
        />
      );
    }

    if (showManualForm) {
      return (
        <div className="form-view">
          <div className="form-shell" style={{ "--accent": "var(--brand)" }}>
            <header className="form-shell-head">
              <span className="panel-title">Új saját recept</span>
              <button
                type="button"
                className="icon-btn"
                aria-label="Űrlap bezárása"
                onClick={() => setShowManualForm(false)}
              >
                <Icon name="xmark" size={14} />
              </button>
            </header>
            <NewRecipeForm
              existingTags={allTags}
              onAddTag={addTag}
              onDeleteTag={deleteTagGlobally}
              onCreate={async (data, imageOpts) => {
                try {
                  await createRecipe(data, imageOpts);
                  setShowManualForm(false);
                  showToast("Recept elmentve", "success");
                  goToTab("receptek");
                } catch (err) {
                  // The recipe itself is already stored in this branch; only the
                  // image failed, so the form is closed either way.
                  if (err?.stage === "image") {
                    setShowManualForm(false);
                    goToTab("receptek");
                  }
                  notifyError(
                    err,
                    err?.stage === "image"
                      ? "A recept elmentve, de a kép feltöltése nem sikerült"
                      : "Recept mentése sikertelen",
                  );
                }
              }}
            />
          </div>
        </div>
      );
    }

    return (
      <NewRecipeView
        fridge={fridge}
        isMobile={isMobile}
        onStartManual={() => setShowManualForm(true)}
        onSaveAiRecipe={createRecipe}
      />
    );
  };

  return (
    <div className="app">
      <div className="app-bg">
        <LightPillar />
      </div>

      <header className="topbar">
        <div className="topbar-main">
          <div className="brand">
            <div className="brand-mark">R</div>
            <div className="brand-name">
              {isMobile ? SCREEN_TITLES[tab] : "Recept Operációs Rendszer"}
            </div>
          </div>

          {isMobile ? (
            <>
              <div className="view-spacer" />
              <button
                type="button"
                className="icon-btn topbar-icon"
                aria-label="Keresés"
                onClick={focusSearch}
              >
                <Icon name="search" size={14} />
              </button>
              <button
                type="button"
                className="topbar-avatar"
                title={`${user?.email || ""} — kijelentkezés`}
                aria-label="Kijelentkezés"
                onClick={async () => {
                  if (!(await confirm("Kijelentkezel?"))) return;
                  signOut(auth).catch((err) =>
                    notifyError(err, "Kijelentkezés sikertelen"),
                  );
                }}
              >
                {(user?.email || "?").charAt(0).toUpperCase()}
              </button>
            </>
          ) : (
            <>
              <div className="topbar-search">
                <div className="search-box">
                  <Icon name="search" size={13} color="#7a7a7a" />
                  <input
                    ref={searchInputRef}
                    placeholder="Keresés receptek, hozzávalók, hűtő…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>
              <div className="topbar-user">
                <span className="topbar-email">
                  {user?.email || "Ismeretlen email"}
                </span>
                <button
                  type="button"
                  className="btn-pill btn-outline"
                  style={{ "--accent": "var(--brand-bright)" }}
                  onClick={() =>
                    signOut(auth).catch((err) =>
                      notifyError(err, "Kijelentkezés sikertelen"),
                    )
                  }
                >
                  Kijelentkezés
                </button>
              </div>
            </>
          )}
        </div>

        {/* Mobile: the magnifier reveals the same search field the other views
            don't show inline. */}
        {isMobile && searchOpen && (
          <div className="topbar-search-mobile">
            <div className="search-box">
              <Icon name="search" size={13} color="#7a7a7a" />
              <input
                autoFocus
                placeholder="Keresés receptek, hozzávalók, hűtő…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        )}

        {!isMobile && (
          <nav className="tabbar-top" aria-label="Fő menü">
            <div className="tabbar-top-inner">
              {TABS.map((t) => {
                const badge = badgeFor(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    className={`tab-top${tab === t.id ? " is-active" : ""}`}
                    style={{ "--accent": t.accent }}
                    aria-current={tab === t.id}
                    onClick={() => goToTab(t.id)}
                  >
                    <Icon name={t.icon} size={14} />
                    {t.label}
                    {badge !== null && <span className="tab-badge">{badge}</span>}
                  </button>
                );
              })}
            </div>
          </nav>
        )}
      </header>

      <LoadingBanner
        loading={dataLoading}
        error={catalogError}
        onRetry={reloadCatalog}
      />

      <main className="app-main">{renderTab()}</main>

      {isMobile && (
        <nav className="tabbar-bottom" aria-label="Fő menü">
          {TABS.map((t) => {
            const badge = badgeFor(t.id);
            return (
              <button
                key={t.id}
                type="button"
                className={`tab-bottom${tab === t.id ? " is-active" : ""}`}
                style={{ "--accent": t.accent }}
                aria-current={tab === t.id}
                onClick={() => goToTab(t.id)}
              >
                <span className="tab-bottom-icon">
                  <Icon name={t.icon} size={19} />
                  {badge !== null && <span className="tab-badge">{badge}</span>}
                </span>
                <span className="tab-bottom-label">{t.shortLabel}</span>
              </button>
            );
          })}
        </nav>
      )}

      {cooking && selectedRecipe && steps.length > 0 && (
        <CookMode
          recipeName={selectedRecipe.name}
          steps={steps}
          ingredients={scaledIngredients}
          step={cookStep}
          isMobile={isMobile}
          onStep={(next) =>
            setCookStep(Math.max(0, Math.min(steps.length - 1, next)))
          }
          onClose={() => setCooking(false)}
        />
      )}
    </div>
  );
}
