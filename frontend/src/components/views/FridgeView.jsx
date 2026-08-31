import Icon from "../Icon/Icon";
import {
  AddItemRow,
  CollapseAllToggle,
  GroupCard,
  ItemRow,
} from "./GroupedItems";
import { useCollapsedGroups } from "../../hooks/useCollapsedGroups";

const ACCENT = "var(--blue)";

// "Hűtő" — the same grouped-card layout as the shopping list, without the
// bought-checkbox, plus a shortcut to the fridge-based AI suggestions.
export default function FridgeView({
  groups,
  itemCount,
  units,
  isMobile,
  colorFor,
  isCustomColor,
  onCategoryColorChange,
  onCategoryColorReset,
  onUpdateItem,
  onSetItemAmount,
  onDeleteItem,
  onAddItem,
  onGoToNew,
}) {
  const { isOpen, toggle, openAll, closeAll, anyClosed } = useCollapsedGroups();
  const summary = `${itemCount} tétel a hűtőben`;
  const collapsibleKeys = groups.map((group) => group.category);

  const collapseToggle = (
    <CollapseAllToggle
      keys={collapsibleKeys}
      anyClosed={anyClosed}
      onOpenAll={openAll}
      onCloseAll={closeAll}
    />
  );

  return (
    <div className="view" style={{ "--accent": ACCENT }}>
      {isMobile ? (
        <div className="view-banner">
          <Icon name="snowflake" size={15} color={ACCENT} />
          <span className="view-banner-text">{summary}</span>
          <button
            type="button"
            className="view-banner-action"
            onClick={onGoToNew}
          >
            Ötletek →
          </button>
        </div>
      ) : (
        <div className="view-head">
          <Icon name="snowflake" size={19} color={ACCENT} />
          <span className="view-title">Hűtő</span>
          <span className="view-pill">{summary}</span>
          <div className="view-spacer" />
          {collapseToggle}
          <AddItemRow units={units} onAdd={onAddItem} />
          <button
            type="button"
            className="btn-pill btn-outline"
            style={{ "--accent": ACCENT }}
            onClick={onGoToNew}
          >
            Ötletek a hűtőből
          </button>
        </div>
      )}

      {isMobile && groups.length > 0 && (
        <div className="list-tools">{collapseToggle}</div>
      )}

      <div className="view-scroll">
        <div className="grid grid-3">
          {groups.length === 0 && (
            <div className="empty-state">
              A hűtő üres. Vegyél fel tételt, vagy tedd át a bevásárlólistát.
            </div>
          )}

          {groups.map((group) => (
            <GroupCard
              key={group.category}
              accent={colorFor(group.category)}
              category={group.category}
              meta={`${group.items.length} tétel`}
              open={isOpen(group.category)}
              onToggle={() => toggle(group.category)}
              isCustomColor={isCustomColor?.(group.category)}
              onColorChange={
                onCategoryColorChange &&
                ((hex) => onCategoryColorChange(group.category, hex))
              }
              onColorReset={
                onCategoryColorReset &&
                (() => onCategoryColorReset(group.category))
              }
            >
              {group.items.map((item) => (
                <ItemRow
                  key={item.id}
                  name={item.displayName || item.name}
                  nameKey={item.nameKey}
                  imageUrl={item.imageUrl}
                  showThumb={!isMobile}
                  qtyLabel={`${item.amount} ${item.unit}`}
                  amount={item.amount}
                  unit={item.unit}
                  units={units}
                  onAmountChange={
                    onSetItemAmount &&
                    ((amount) => onSetItemAmount(item, { amount }))
                  }
                  onUnitChange={
                    onSetItemAmount && ((unit) => onSetItemAmount(item, { unit }))
                  }
                  onIncrement={() => onUpdateItem(item, 1)}
                  onDecrement={() => onUpdateItem(item, -1)}
                  disableDecrement={item.amount <= 1}
                  onDelete={() => onDeleteItem(item)}
                />
              ))}
            </GroupCard>
          ))}
        </div>
      </div>

      {isMobile && <AddItemRow units={units} onAdd={onAddItem} />}
    </div>
  );
}
