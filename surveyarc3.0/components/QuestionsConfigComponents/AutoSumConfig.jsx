"use client";


export default function AutoSumConfig({ config = {}, updateConfig }) {
  const items = Array.isArray(config.items)
    ? config.items
    : ["Item 1", "Item 2"];

  const total = config.total ?? 100;
  const showRemaining = config.showRemaining ?? true;
  const allowDecimals = config.allowDecimals ?? false;

  const updateItems = (next) => updateConfig("items", next);

  const handleItemChange = (i, val) => {
    const next = [...items];
    next[i] = val;
    updateItems(next);
  };

  const addItem = () =>
    updateItems([...items, `Item ${items.length + 1}`]);

  const removeItem = (i) =>
    updateItems(items.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500">
        Respondents must distribute a fixed total across all items.
      </p>

      {/* Items */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Items</label>
        {items.map((item, i) => (
          <div key={i} className="flex gap-2">
            <input
              className="flex-1 px-3 py-2 border rounded"
              value={item}
              onChange={(e) => handleItemChange(i, e.target.value)}
            />
            <button
              onClick={() => removeItem(i)}
              className="text-xs text-red-500"
            >
              Remove
            </button>
          </div>
        ))}
        <button onClick={addItem} className="text-xs underline">
          + Add item
        </button>
      </div>

      {/* Rules */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm">Total to allocate</label>
          <input
            type="number"
            value={total}
            onChange={(e) =>
              updateConfig("total", Number(e.target.value))
            }
            className="w-full px-3 py-2 border rounded"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm">Options</label>
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={showRemaining}
              onChange={(e) =>
                updateConfig("showRemaining", e.target.checked)
              }
            />
            Show remaining total
          </label>

          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={allowDecimals}
              onChange={(e) =>
                updateConfig("allowDecimals", e.target.checked)
              }
            />
            Allow decimals
          </label>
        </div>
      </div>
    </div>
  );
}
