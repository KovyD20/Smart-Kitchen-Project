import { useState } from "react";
import ItemActions from "./ItemActions";
import ItemAddForm from "./ItemAddForm";

export default function ShoppingListPanel({
  shoppingList,
  newShoppingItem,
  units,
  onChangeNewItem,
  onAddNewItem,
  onUpdateItem,
  onDeleteItem,
  onClearList,
  onMoveToFridge,
  smallBtn,
}) {
  const [collapsed, setCollapsed] = useState(false);

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
          {shoppingList.length === 0 ? (
            <p>Üres</p>
          ) : (
            <ul>
              {shoppingList.map((item) => (
                <li key={item.id}>
                  <span style={{ flex: 1 }}>
                    {item.name} -{" "}
                    <span className="amount-highlight">
                      {item.amount} {item.unit}
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
        </>
      )}
    </div>
  );
}
