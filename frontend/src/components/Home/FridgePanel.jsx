import { useState } from "react";
import ItemActions from "./ItemActions";
import ItemAddForm from "./ItemAddForm";

export default function FridgePanel({
  fridge,
  groupedFridge,
  newFridgeItem,
  units,
  onChangeNewItem,
  onAddNewItem,
  onUpdateItem,
  onDeleteItem,
  smallBtn,
}) {
  const [collapsed, setCollapsed] = useState(false);
  const hasItems = fridge.length > 0;
  const groups = groupedFridge || [];

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
            className="fridge-add"
            item={newFridgeItem}
            units={units}
            onChange={onChangeNewItem}
            onSubmit={onAddNewItem}
            submitLabel="Tétel hozzáadása +"
          />
        </>
      )}
    </div>
  );
}
