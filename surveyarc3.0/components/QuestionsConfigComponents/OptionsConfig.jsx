import React from 'react';
import QUESTION_TYPES from '@/enums/questionTypes';
import { RiDeleteBin6Line } from "react-icons/ri";

export default function OptionsConfig({ config, updateConfig, type }) {
  const options = Array.isArray(config.options) ? config.options : [];

  const handleOptionChange = (index, value) => {
    const newOptions = [...options];
    newOptions[index] = value;
    updateConfig('options', newOptions);
  };

  const addOption = () => {
    updateConfig('options', [...options, '']);
  };

  const removeOption = (index) => {
    const newOptions = options.filter((_, i) => i !== index);
    updateConfig('options', newOptions);
  };

  return (
    <div className="space-y-2 dark:bg-[#1A1A1E] dark:text-[#96949C]">
      <label className="block dark:text-[#96949C] text-sm">{type === QUESTION_TYPES.CHECKBOX ? 'Checkbox options' : type === QUESTION_TYPES.DROPDOWN ? 'Dropdown options' : 'Choices'}</label>
      {options.map((opt, i) => (
        <div key={i} className="flex items-center gap-10">
          <input
            className="border border-[#8C8A97] dark:bg-[#1A1A1E] py-1 px-4 rounded flex-grow"
            value={opt}
            onChange={e => handleOptionChange(i, e.target.value)}
            placeholder={`Option ${i + 1}`}
          />
          <button
            type="button"
            onClick={() => removeOption(i)}
            className="text-red-500"
          >
          <RiDeleteBin6Line size={22} />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={addOption}
        className="bg-[#D5D5D5] text-black px-3 text-sm py-1 rounded"
      >
        + Add Option
      </button>
    </div>
  );
}
