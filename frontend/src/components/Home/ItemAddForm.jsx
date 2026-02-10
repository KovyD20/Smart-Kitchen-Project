export default function ItemAddForm({
  item,
  units,
  onChange,
  onSubmit,
  submitLabel,
  className,
}) {
  return (
    <div className={className || "item-add"}>
      <input
        style={{ width: "80px" }}
        placeholder="név"
        value={item.name}
        onChange={(e) => onChange("name", e.target.value)}
      />

      <input
        style={{ width: "50px" }}
        type="number"
        min="0"
        step="1"
        placeholder="menny."
        value={item.amount}
        onChange={(e) => {
          const val = Math.max(0, Number(e.target.value));
          onChange("amount", val);
        }}
      />

      <select
        value={item.unit}
        onChange={(e) => onChange("unit", e.target.value)}
      >
        {units.map((u) => (
          <option key={u} value={u}>
            {u}
          </option>
        ))}
      </select>
      <div></div>
      <button onClick={onSubmit}>{submitLabel}</button>
    </div>
  );
}
