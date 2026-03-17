import { useState } from "react";
import ItemActions from "./ItemActions";
import ItemAddForm from "./ItemAddForm";

export default function ShoppingListPanel({
  shoppingList,
  groupedShoppingList,
  newShoppingItem,
  units,
  missingEssentialItems,
  recommendedGoodToHaveItems,
  recommendedExtraItems,
  onAddRecommendedEssentialItem,
  onChangeNewItem,
  onAddNewItem,
  onUpdateItem,
  onDeleteItem,
  onClearList,
  onMoveToFridge,
  smallBtn,
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [showRecommended, setShowRecommended] = useState(false);
  const hasItems = shoppingList.length > 0;
  const groups = groupedShoppingList || [];
  const essentialItems = missingEssentialItems || [];
  const goodToHaveItems = recommendedGoodToHaveItems || [];
  const extraItems = recommendedExtraItems || [];

  return (
    <div className={`shopping-list${collapsed ? " panel-collapsed" : ""}`}>
      <div className="panel-header">
        <h3>Bevásárlólista</h3>
        <button
          type="button"
          className="panel-toggle"
          aria-expanded={!collapsed}
          onClick={() => setCollapsed((prev) => !prev)}
        >
          {collapsed ? ">" : "-"}
        </button>
      </div>

      {!collapsed && (
        <>
          {!hasItems ? (
            <p>Üres</p>
          ) : (
            <div className="item-groups">
              {groups.map((group) => (
                <div key={group.category} className="item-group">
                  <h4 className="item-group-title">{group.category}</h4>
                  <ul>
                    {group.items.map((item) => (
                      <li key={item.id}>
                        <span style={{ flex: 1 }}>
                          <span className="item-name">
                            {item.displayName || item.name}
                          </span>{" "}
                          -{" "}
                          <span className="item-quantity">
                            <span className="item-amount">{item.amount}</span>{" "}
                            <span className="item-unit">{item.unit}</span>
                          </span>
                        </span>
                        <ItemActions
                          smallBtn={smallBtn}
                          onIncrement={() => onUpdateItem(item, 1)}
                          onDecrement={() => onUpdateItem(item, -1)}
                          disableDecrement={item.amount <= 1}
                          onDelete={() => onDeleteItem(item)}
                        />
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}

          <ItemAddForm
            className="shopping-add"
            item={newShoppingItem}
            units={units}
            onChange={onChangeNewItem}
            onSubmit={onAddNewItem}
            submitLabel="+"
          />

          <button className="shopping-clear" onClick={onClearList}>
            Lista törlése
          </button>
          <button className="shopping-move" onClick={onMoveToFridge}>
            Hűtőbe rak
          </button>

          <div className="shopping-recommendations">
            <h4 className="shopping-rec-title">Hiányzó tételek (Essential)</h4>
            {essentialItems.length === 0 ? (
              <p className="shopping-rec-empty">
                Nincs hiányzó essential tétel.
              </p>
            ) : (
              <ul className="shopping-rec-list">
                {essentialItems.map((item) => (
                  <li key={`essential-${item.key}`} className="shopping-essential-item">
                    <span className="shopping-essential-name">{item.name}</span>
                    <span className="shopping-rec-category">{item.category}</span>
                    <button
                      type="button"
                      className="shopping-essential-add"
                      onClick={() => onAddRecommendedEssentialItem?.(item)}
                    >
                      Hozzáad
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <button
              type="button"
              className="shopping-recommended-toggle"
              onClick={() => setShowRecommended((prev) => !prev)}
            >
              További ajánlott tételek
            </button>

            {showRecommended && (
              <div className="shopping-rec-groups">
                <h5>Good to have</h5>
                {goodToHaveItems.length === 0 ? (
                  <p className="shopping-rec-empty">
                    Jelenleg nincs hiányzó good to have tétel.
                  </p>
                ) : (
                  <ul className="shopping-rec-list">
                    {goodToHaveItems.map((item) => (
                      <li key={`good-${item.key}`}>
                        <span>{item.name}</span>
                        <span className="shopping-rec-category">
                          {item.category}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}

                <h5>Extra</h5>
                {extraItems.length === 0 ? (
                  <p className="shopping-rec-empty">
                    Jelenleg nincs hiányzó extra tétel.
                  </p>
                ) : (
                  <ul className="shopping-rec-list">
                    {extraItems.map((item) => (
                      <li key={`extra-${item.key}`}>
                        <span>{item.name}</span>
                        <span className="shopping-rec-category">
                          {item.category}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
