import { useState } from "react";
import Icon from "../Icon/Icon";
import { AddItemRow, GroupCard, ItemRow } from "./GroupedItems";
import { useCollapsedGroups } from "../../hooks/useCollapsedGroups";

const ACCENT = "var(--yellow)";

// The catalog knows which pantry staples the user is missing entirely; the design
// has no slot for it, so it rides along as a dashed card in the same grid.
function RecommendationsCard({ essential, goodToHave, extra, onAdd }) {
  const { isOpen, toggle } = useCollapsedGroups();
  const [showMore, setShowMore] = useState(false);

  return (
    <div className="rec-card">
      <button
        type="button"
        className="group-head"
        style={{ "--accent": "#4a4a4a" }}
        aria-expanded={isOpen("rec")}
        onClick={() => toggle("rec")}
      >
        <span className="group-name">Ajánlott alapok</span>
        <span className="group-meta">{essential.length} hiányzik</span>
        <Icon
          name={isOpen("rec") ? "chevronUp" : "chevronDown"}
          size={11}
          color="#7d7d7d"
        />
      </button>

      {isOpen("rec") && (
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
  onToggleDone,
  onUpdateItem,
  onDeleteItem,
  onAddItem,
  onClearDone,
  onMoveToFridge,
}) {
  const { isOpen, toggle } = useCollapsedGroups();

  const summary = `${openCount} tétel hátra · ${doneCount} kész`;
  const hasGroups = groups.length > 0;

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
        <button
          type="button"
          className="btn-pill btn-outline"
          style={{ "--accent": "var(--blue)", width: "100%" }}
          disabled={!hasGroups}
          onClick={onMoveToFridge}
        >
          <Icon name="swap" size={12} />
          Hűtőbe rak
        </button>
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
                accent={ACCENT}
                category={group.category}
                meta={`${done}/${group.items.length}`}
                open={isOpen(group.category)}
                onToggle={() => toggle(group.category)}
              >
                {group.items.map((item) => (
                  <ItemRow
                    key={item.id}
                    name={item.displayName || item.name}
                    qtyLabel={`${item.amount} ${item.unit}`}
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
          />
        </div>
      </div>

      {isMobile && <AddItemRow units={units} onAdd={onAddItem} />}
    </div>
  );
}
