import { useState } from "react";
import Icon from "../Icon/Icon";
import {
  AddItemRow,
  CollapseAllToggle,
  ColorEditToggle,
  GroupCard,
  ItemRow,
} from "./GroupedItems";
import { useCollapsedGroups } from "../../hooks/useCollapsedGroups";
import { useListKeyboardNav } from "../../hooks/useListKeyboardNav";

const ACCENT = "var(--blue)";

// "Hűtő" — the same grouped-card layout as the shopping list, without the
// bought-checkbox, plus a shortcut to the fridge-based AI suggestions.
export default function FridgeView({
  groups,
  itemCount,
  units,
  suggest,
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
  // Off until asked for, same as the shopping list.
  const [colorEditing, setColorEditing] = useState(false);
  // Same arrow-key navigation as the shopping list (phase 6.3).
  const {
    containerRef: navContainerRef,
    onKeyDown: onNavKeyDown,
    itemProps: navItemProps,
    markRemoval: markNavRemoval,
    clearRemoval: clearNavRemoval,
  } = useListKeyboardNav();

  const deleteItem = async (item) => {
    markNavRemoval(item.id);
    try {
      await onDeleteItem(item);
    } finally {
      clearNavRemoval();
    }
  };

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

  const colorToggle = onCategoryColorChange && (
    <ColorEditToggle
      groupCount={groups.length}
      active={colorEditing}
      onToggle={() => setColorEditing((prev) => !prev)}
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
          {colorToggle}
          <AddItemRow units={units} onAdd={onAddItem} suggest={suggest} />
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
        <div className="list-tools">
          {collapseToggle}
          {colorToggle}
        </div>
      )}

      <div
        className="view-scroll"
        ref={navContainerRef}
        tabIndex={-1}
        onKeyDown={onNavKeyDown}
      >
        <div className="grid grid-3">
          {groups.length === 0 && (
            <div className="empty-state">
              A hűtő üres. Vegyél fel tételt, vagy tedd át a bevásárlólistát.
            </div>
          )}

          {groups.map((group, groupIndex) => (
            <GroupCard
              key={group.category}
              navProps={navItemProps(`group:${group.category}`, {
                first: groupIndex === 0,
              })}
              accent={colorFor(group.category)}
              category={group.category}
              meta={`${group.items.length} tétel`}
              open={isOpen(group.category)}
              onToggle={() => toggle(group.category)}
              isCustomColor={isCustomColor?.(group.category)}
              colorEditing={colorEditing}
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
                  navProps={navItemProps(item.id)}
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
                  onDelete={() => deleteItem(item)}
                />
              ))}
            </GroupCard>
          ))}
        </div>
      </div>

      {isMobile && (
        <AddItemRow
          units={units}
          onAdd={onAddItem}
          suggest={suggest}
          dropUp
        />
      )}
    </div>
  );
}
