"use client";
import React from "react";

export default function MatrixConfig({ config, updateConfig }) {
  const rows = Array.isArray(config.rows) ? config.rows : ["Row 1", "Row 2"];
  const cols = Array.isArray(config.cols) ? config.cols : ["Column 1"];
  const inputType = config.type || "radio";

  const updateRows = (newRows) => updateConfig("rows", newRows);
  const updateCols = (newCols) => updateConfig("cols", newCols);

  const handleTypeChange = (e) => updateConfig("type", e.target.value);

  const handleRowLabelChange = (i, val) => {
    const newRows = [...rows];
    newRows[i] = val;
    updateRows(newRows);
  };

  const handleColLabelChange = (i, val) => {
    const newCols = [...cols];
    newCols[i] = val;
    updateCols(newCols);
  };

  const addRow = () => updateRows([...rows, `Row ${rows.length + 1}`]);
  const addCol = () => updateCols([...cols, `Column ${cols.length + 1}`]);

  const removeRow = (i) => updateRows(rows.filter((_, idx) => idx !== i));
  const removeCol = (i) => updateCols(cols.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-6 dark:bg-[#1A1A1E] dark:text-[#96949C]">
      <div>
        <label className="block text-sm mb-2">Input Type</label>
        <select
          className="w-full border dark:bg-[#1A1A1E] border-gray-300 outline-none p-2 rounded"
          value={inputType}
          onChange={handleTypeChange}
        >
          <option value="radio">Single Select (Radio)</option>
          <option value="checkbox">Multi Select (Checkbox)</option>
        </select>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm text-gray-700">Matrix Preview</h3>
        <div className="flex justify-end items-end">
          <button onClick={addCol} className="text-sm hover:underline">
            Insert column
          </button>
        </div>
        <div className="rounded-xl shadow-md border border-gray-200 w-full overflow-auto ">
          <div className=" h-full w-full">
            <table className=" text-sm">
              <thead>
                <tr className="bg-orange-50 dark:bg-[#1A1A1E] text-gray-800">
                  <th className="p-3 text-left"></th>
                  {cols.map((col, i) => (
                    <th key={i} className="p-3 text-center font-medium">
                      <input
                        type="text"
                        value={col}
                        onChange={(e) =>
                          handleColLabelChange(i, e.target.value)
                        }
                        className="text-center px-2 py-1  outline-none rounded w-full"
                        placeholder={`Column ${i + 1}`}
                      />
                      <button
                        onClick={() => removeCol(i)}
                        className="text-xs mx-auto text-red-500 hover:underline mt-1 block"
                      >
                        Remove
                      </button>
                    </th>
                  ))}
                  <th className="p-3 text-right align-top"></th>
                </tr>
              </thead>

              <tbody className="bg-white dark:bg-[#1A1A1E]">
                {rows.map((row, rowIndex) => (
                  <tr key={rowIndex} className="border-t">
                    <td className="bg-white dark:bg-[#1A1A1E] px-3 py-2">
                      <input
                        type="text"
                        value={row}
                        onChange={(e) =>
                          handleRowLabelChange(rowIndex, e.target.value)
                        }
                        className="border border-gray-300 rounded px-2 py-1 w-[70px]"
                        placeholder={`Row ${rowIndex + 1}`}
                      />
                    </td>

                    {cols.map((_, colIndex) => (
                      <td key={colIndex} className="text-center px-3 py-2">
                        <input
                          type={inputType}
                          disabled
                          className="w-5 h-5 text-primary"
                        />
                      </td>
                    ))}

                    <td className="text-center px-3 py-2">
                      <button
                        onClick={() => removeRow(rowIndex)}
                        className="text-xs text-red-500 hover:underline"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}

                <tr className="border-t">
                  <td
                    colSpan={cols.length + 2}
                    className="text-left px-4 py-3"
                  ></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <button onClick={addRow} className="text-sm hover:underline">
          Insert Row
        </button>
      </div>
    </div>
  );
}
