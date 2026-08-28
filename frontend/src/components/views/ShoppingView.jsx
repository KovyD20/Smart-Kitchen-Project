import { useState } from "react";
import Icon from "../Icon/Icon";
import {
  AddItemRow,
  CollapseAllToggle,
  GroupCard,
  ItemRow,
} from "./GroupedItems";
import { useCollapsedGroups } from "../../hooks/useCollapsedGroups";

const ACCENT = "var(--yellow)";
// Collapse key for the recommendations card, which is not a real category.
const REC_KEY = "rec";

// The catalog knows which pantry staples the user is missing entirely; the design
// has no slot for it, so it rides along as a dashed card in the same grid.
function RecommendationsCard({
  essential,
  goodToHave,
  extra,
  onAdd,
  isOpen,
  toggle,
}) {
  const [showMore, setShowMore] = useState(false);

  return (
    <div className="rec-card">
      <button
        type="button"
        className="group-head"
        style={{ "--accent": "#4a4a4a" }}
        aria-expanded={isOpen(REC_KEY)}
        onClick={() => toggle(REC_KEY)}
      >
        <span className="group-name">Ajánlott alapok</span>
        <span className="group-meta">{essential.length} hiányzik</span>
        <Icon
          name={isOpen("rec") ? "chevronUp" : "chevronDown"}
          size={11}
          color="#7d7d7d"
        />
      </button>

      {isOpen(REC_KEY) && (
        <div className="rec-list">
          {essential.length === 0 ? (
            <p className="rec-empty">Minden alapvető tétel megvan.</p>
          ) : (
            essential.map((item) => (
              <div key={item.key} className="rec-row">
                <span className="rec-row-name">{item.name}</span>
                <span className="rec-row-cat">{item.category}</span>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={`${item.name} a listára`}
                  onClick={() => onAdd(item)}
                >
                  <Icon name="plus" size={11} />
                </button>
              </div>
            ))
          )}

          <button
            type="button"
            className="rec-more"
            onClick={() => setShowMore((prev) => !prev)}
          >
            {showMore ? "Kevesebb" : "További ajánlott tételek"} (
            {goodToHave.length + extra.length})
          </button>

          {showMore &&
            [
              ["Jó, ha van", goodToHave],
              ["Extra", extra],
            ].map(([label, items]) => (
              <div key={label}>
                <div className="rec-empty">{label}</div>
                {items.length === 0 ? (
                  <p className="rec-empty">Nincs hiányzó tétel.</p>
                ) : (
                  items.map((item) => (
                    <div key={item.key} className="rec-row">
                      <span className="rec-row-name">{item.name}</span>
                      <span className="rec-row-cat">{item.category}</span>
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label={`${item.name} a listára`}
                        onClick={() => onAdd(item)}
                      >
                        <Icon name="plus" size={11} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

// "Bevásárlólista" — category cards, tick items off, adjust amounts.
export default function ShoppingView({
  groups,
  openCount,
  doneCount,
  units,
  recommendations,
  isMobile,
  colorFor,
  isCustomColor,
  onCategoryColorChange,
  onCategoryColorReset,
  onToggleDone,
  onUpdateItem,
  onDeleteItem,
  onAddItem,
  onClearDone,
  onMoveToFridge,
}) {
  const { isOpen, toggle, openAll, closeAll, anyClosed } = useCollapsedGroups();

  const summary = `${openCount} tétel hátra · ${doneCount} kész`;
  const hasGroups = groups.length > 0;
  // The recommendations card sits in the same grid, so it collapses with the rest.
  const collapsibleKeys = [...groups.map((group) => group.category), REC_KEY];

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
          <Icon name="cart" size={15} color={ACCENT} />
          <span className="view-banner-text">{summary}</span>
          <button
            type="button"
            className="view-banner-action"
            disabled={doneCount === 0}
            onClick={onClearDone}
          >
            Kész tételek törlése
          </button>
        </div>
      ) : (
        <div className="view-head">
          <Icon name="cart" size={19} color={ACCENT} />
          <span className="view-title">Bevásárlólista</span>
          <span className="view-pill">{summary}</span>
          <div className="view-spacer" />
          {collapseToggle}
          <AddItemRow units={units} onAdd={onAddItem} />
          <button
            type="button"
            className="btn-pill btn-outline"
            style={{ "--accent": "var(--blue)" }}
            disabled={!hasGroups}
            onClick={onMoveToFridge}
          >
            <Icon name="swap" size={12} />
            Hűtőbe rak
          </button>
          <button
            type="button"
            className="btn-pill btn-outline btn-outline-neutral"
            disabled={doneCount === 0}
            onClick={onClearDone}
          >
            Kész tételek törlése
          </button>
        </div>
      )}

      {isMobile && (
        <div className="list-tools">
          <button
            type="button"
            className="btn-pill btn-outline"
            style={{ "--accent": "var(--blue)", flex: 1 }}
            disabled={!hasGroups}
            onClick={onMoveToFridge}
          >
            <Icon name="swap" size={12} />
            Hűtőbe rak
          </button>
          {collapseToggle}
        </div>
      )}

      <div className="view-scroll">
        <div className="grid grid-3">
          {!hasGroups && (
            <div className="empty-state">
              A bevásárlólista üres. Vegyél fel tételt, vagy add hozzá egy recept
              hozzávalóit.
            </div>
          )}

          {groups.map((group) => {
            const done = group.items.filter((item) => item.done).length;
            return (
              <GroupCard
                key={group.category}
                accent={colorFor(group.category)}
                category={group.category}
                meta={`${done}/${group.items.length}`}
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
                    note={
                      item.sourceAmount
                        ? `recept: ${item.sourceAmount} ${item.sourceUnit || ""}`.trim()
                        : null
                    }
                    done={item.done}
                    onToggleDone={() => onToggleDone(item)}
                    onIncrement={() => onUpdateItem(item, 1)}
                    onDecrement={() => onUpdateItem(item, -1)}
                    disableDecrement={item.amount <= 1}
                    onDelete={() => onDeleteItem(item)}
                  />
                ))}
              </GroupCard>
            );
          })}

          <RecommendationsCard
            essential={recommendations.essential}
            goodToHave={recommendations.goodToHave}
            extra={recommendations.extra}
            onAdd={(item) => onAddItem({ name: item.name, amount: 1, unit: "db" })}
            isOpen={isOpen}
            toggle={toggle}
          />
        </div>
      </div>

      {isMobile && <AddItemRow units={units} onAdd={onAddItem} />}
    </div>
  );
}
