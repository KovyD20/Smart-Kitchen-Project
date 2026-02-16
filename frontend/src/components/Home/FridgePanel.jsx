import { useState } from "react";
import ItemActions from "./ItemActions";
import ItemAddForm from "./ItemAddForm";

export default function FridgePanel({
  fridge,
  newFridgeItem,
  units,
  onChangeNewItem,
  onAddNewItem,
  onUpdateItem,
  onDeleteItem,
  smallBtn,
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className={`fridge${collapsed ? " panel-collapsed" : ""}`}>
      <div className="panel-header">
        <h3>Hűtő</h3>
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
          {fridge.length === 0 ? (
            <p>Üres</p>
          ) : (
            <ul>
              <div></div>
              {fridge.map((item) => (
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
                    <span className="item-name">{item.name}</span> -{" "}
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
          )}

          <ItemAddForm
            className="fridge-add"
            item={newFridgeItem}
            units={units}
            onChange={onChangeNewItem}
            onSubmit={onAddNewItem}
            submitLabel="Tétel hozzáadása+"
          />
        </>
      )}
    </div>
  );
}
