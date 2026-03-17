export default function ItemActions({
  onIncrement,
  onDecrement,
  onDelete,
  disableDecrement,
  smallBtn,
}) {
  return (
    <div className="item-actions">
      <button style={smallBtn} disabled={disableDecrement} onClick={onDecrement}>
        -
      </button>
      <button style={smallBtn} onClick={onIncrement}>
        +
      </button>
      <button style={smallBtn} onClick={onDelete}>
        Törlés
      </button>
    </div>
  );
}
