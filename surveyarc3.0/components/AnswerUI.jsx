// File: components/RenderQuestion.js
"use client";

import QUESTION_TYPES from "@/enums/questionTypes";
import {
  CheckCircle,
  Circle,
  CheckSquare,
  Square,
  Star,
  Upload,
  GripVertical,
} from "lucide-react";
import { useState } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

function SortableItem({ id }) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="flex items-center gap-2 p-3 rounded-lg border border-yellow-400 dark:border-orange-400 bg-orange-50 dark:bg-gray-800 text-gray-800 dark:text-[#96949C] cursor-move"
    >
      <GripVertical className="text-orange-400" />
      <span className="font-medium">{id}</span>
    </li>
  );
}
export default function RenderQuestion({
  question,
  value,
  onChange,
  config,
  inputClasses,
}) {
  const questionType = question.type;
  switch (questionType) {
    case QUESTION_TYPES.CONTACT_EMAIL:
    case QUESTION_TYPES.CONTACT_WEBSITE:
      return (
        <input
          type="email"
          placeholder={config.placeholder}
          className={inputClasses}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case QUESTION_TYPES.CONTACT_PHONE:
      return (
        <input
          type="tel"
          placeholder={config.placeholder}
          className={inputClasses}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case QUESTION_TYPES.CONTACT_ADDRESS:
    case QUESTION_TYPES.LONG_TEXT:
      return (
        <textarea
          placeholder={config.placeholder}
          className={`${inputClasses} min-h-[120px] dark:bg-[#1A1A1E]  resize-none`}
          value={value}
          maxLength={config.maxLength}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case QUESTION_TYPES.SHORT_TEXT:
    case QUESTION_TYPES.NUMBER:
      return (
        <input
          type={questionType === QUESTION_TYPES.NUMBER ? "number" : "text"}
          placeholder={config.placeholder}
          className={inputClasses}
          value={value}
          maxLength={config.maxLength}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case QUESTION_TYPES.RATING:
      const max = config.maxStars || 5;
      return (
        <div className="flex gap-2">
          {Array.from({ length: max }, (_, i) => i + 1).map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => onChange(star)}
              className="focus:outline-none"
            >
              <Star
                className={`w-8 h-8 transition-transform transform hover:scale-110 ${
                  value >= star
                    ? "text-orange-500"
                    : "text-gray-300 dark:text-gray-600"
                }`}
                fill={value >= star ? "#f97316" : "none"}
              />
            </button>
          ))}
        </div>
      );

    case QUESTION_TYPES.MULTIPLE_CHOICE:
      return (
        <div className="space-y-3">
          {config.options?.map((option, i) => (
            <label
              key={i}
              className={`flex items-center p-4 rounded-3xl lg:rounded-xl lg:border-2 lg:dark:border-none cursor-pointer transition-all duration-200 hover:scale-105 ${
                value === option
                  ? "bg-[#F1882A] lg:border-orange-400 text-white"
                  : "bg-white shadow-md dark:bg-gray-800 border-yellow-400 dark:border-orange-400 text-gray-800 dark:text-[#96949C] hover:bg-orange-100 dark:hover:bg-gray-700"
              }`}
            >
              <div className="flex items-center">
                {value === option ? (
                  <CheckCircle size={20} className="mr-3" />
                ) : (
                  <Circle size={20} className="mr-3" />
                )}
              </div>
              <input
                type="radio"
                name={question.questionId}
                value={option}
                checked={value === option}
                onChange={() => onChange(option)}
                className="sr-only"
              />
              <span className="font-medium text-xs lg:text-base">{option}</span>
            </label>
          ))}
        </div>
      );

    case QUESTION_TYPES.DROPDOWN:
      return (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={inputClasses}
        >
          <option value="">Select an option...</option>
          {config.options?.map((option, i) => (
            <option key={i} value={option}>
              {option}
            </option>
          ))}
        </select>
      );

    case QUESTION_TYPES.LEGAL:
      return (
        <div className="space-y-5">
          <div className="bg-orange-100 dark:bg-gray-800 p-4 rounded-xl border-l-4 border-orange-500 dark:border-orange-400 text-gray-800 dark:text-[#96949C] text-sm">
            {config.legalText ||
              "Please review and accept the terms and conditions before continuing."}
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-800 dark:text-[#CBC9DE]">
            <input
              type="checkbox"
              checked={value === true}
              onChange={(e) => onChange(e.target.checked)}
              className="accent-orange-500"
            />
            <span>
              {config.checkboxLabel || "I agree to the terms and conditions."}
            </span>
          </label>
        </div>
      );

    case QUESTION_TYPES.YES_NO:
      return (
        <div className="flex gap-4">
          {["yes", "no"].map((option) => (
            <label
              key={option}
              className={`flex-1 flex items-center justify-center p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 hover:scale-105 ${
                value === option
                  ? "bg-orange-500 border-orange-400 text-white"
                  : "bg-orange-50 dark:bg-gray-800 border-yellow-400 dark:border-orange-400 text-gray-800 dark:text-[#96949C] hover:bg-orange-100 dark:hover:bg-gray-700"
              }`}
            >
              <input
                type="radio"
                value={option}
                checked={value === option}
                onChange={() => onChange(option)}
                className="sr-only"
              />
              <span className="font-medium">
                {option === "yes"
                  ? config.yesLabel || "Yes"
                  : config.noLabel || "No"}
              </span>
            </label>
          ))}
        </div>
      );

    case QUESTION_TYPES.CHECKBOX:
      const selected = Array.isArray(value) ? value : [];
      return (
        <div className="space-y-3">
          {config.options?.map((option, i) => (
            <label
              key={i}
              className={`flex items-center p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 hover:scale-105 ${
                selected.includes(option)
                  ? "bg-orange-500 border-orange-400 text-white"
                  : "bg-orange-50 dark:bg-[#121214] border-yellow-400 dark:border-[#96949C] text-gray-800 dark:text-[#CBC9DE] hover:bg-orange-100 dark:hover:bg-gray-700"
              }`}
            >
              <div className="flex items-center">
                {selected.includes(option) ? (
                  <CheckSquare size={20} className="mr-3" />
                ) : (
                  <Square size={20} className="mr-3" />
                )}
              </div>
              <input
                type="checkbox"
                checked={selected.includes(option)}
                onChange={(e) => {
                  if (e.target.checked) onChange([...selected, option]);
                  else onChange(selected.filter((item) => item !== option));
                }}
                className="sr-only"
              />
              <span className="font-medium">{option}</span>
            </label>
          ))}
        </div>
      );
    
      case QUESTION_TYPES.PICTURE_CHOICE:
      return (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {config.images?.map((img, index) => (
            <button
              key={index}
              type="button"
              onClick={() => onChange(img.url)}
              className={`border-2 rounded-xl p-2 flex flex-col items-center justify-center shadow-sm transition-all ${
                value === img.url
                  ? "border-orange-500"
                  : "border-gray-300 dark:border-gray-700"
              }`}
            >
              <img
                src={img.url}
                alt={img.label || `Option ${index + 1}`}
                className="w-full h-32 object-cover rounded-md"
              />
              {img.label && (
                <span className="mt-2 text-sm font-medium text-gray-700 dark:text-[#96949C]">
                  {img.label}
                </span>
              )}
            </button>
          ))}
        </div>
      );

    case QUESTION_TYPES.VIDEO:
      const isDirectVideoFile = (url) => /\.(mp4|webm|ogg)$/i.test(url);

      const getTransformedEmbedUrl = (inputUrl) => {
        try {
          const url = new URL(inputUrl);

          if (
            url.hostname.includes("youtube.com") ||
            url.hostname.includes("youtu.be")
          ) {
            const videoId =
              url.searchParams.get("v") || url.pathname.split("/")[1];
            return `https://www.youtube.com/embed/${videoId}`;
          }

          if (url.hostname.includes("vimeo.com")) {
            const videoId = url.pathname.split("/")[1];
            return `https://player.vimeo.com/video/${videoId}`;
          }

          return inputUrl;
        } catch {
          return inputUrl;
        }
      };

      const videoUrl = config?.url || config?.videoUrl || "";
      const embedUrl = getTransformedEmbedUrl(videoUrl);

      return (
        <div className="w-full aspect-video rounded-xl overflow-hidden border-2">
          {isDirectVideoFile(embedUrl) ? (
            <video controls className="w-full h-full bg-black">
              <source src={embedUrl} />
              Your browser does not support the video tag.
            </video>
          ) : (
            <iframe
              className="w-full h-full"
              src={embedUrl}
              title="Embedded Video"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          )}
        </div>
      );

    case QUESTION_TYPES.FILE_UPLOAD:
      const isImage = value && value.type?.startsWith("image/");
      return (
        <div className="border-2 border-dashed rounded-xl p-6 text-center cursor-pointer hover:bg-orange-50 dark:hover:bg-gray-800 transition-colors">
          <label className="flex flex-col items-center gap-2">
            <Upload className="w-6 h-6 text-orange-500" />
            <span className="text-sm text-gray-700 dark:text-[#96949C]">
              Click to upload file
            </span>
            <input
              type="file"
              accept={config.allowedTypes?.join(",")}
              onChange={(e) => onChange(e.target.files[0])}
              className="hidden"
            />
          </label>
          {value?.name && (
            <div className="mt-4">
              {isImage ? (
                <img
                  src={URL.createObjectURL(value)}
                  alt="Uploaded preview"
                  className="max-w-xs mx-auto rounded shadow-md border border-gray-300"
                />
              ) : (
                <p className="text-sm text-green-600 dark:text-green-400 font-medium">
                  Selected: {value.name}
                </p>
              )}
            </div>
          )}
        </div>
      );
    case QUESTION_TYPES.DATE:
      return (
        <input
          type="date"
          placeholder={config.placeholder}
          min={config.minDate}
          max={config.maxDate}
          className={inputClasses}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case QUESTION_TYPES.GOOGLE_DRIVE: {
      const folderId = config.folderId;
      const viewMode = config.viewMode || "list"; // 'list', 'grid', or 'picker'

      if (!folderId) {
        return (
          <div className="text-sm text-red-500 p-4 bg-red-50 dark:bg-red-900 rounded">
            Google Drive folder ID not configured.
          </div>
        );
      }

      const embedUrl = (() => {
        switch (viewMode) {
          case "grid":
            return `https://drive.google.com/embeddedfolderview?id=${folderId}#grid`;
          case "picker":
            // Picker requires OAuth2 and JS API – not embeddable via iframe
            return null;
          case "list":
          default:
            return `https://drive.google.com/embeddedfolderview?id=${folderId}#list`;
        }
      })();

      if (!embedUrl) {
        return (
          <div className="p-4 rounded bg-yellow-50 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300">
            Picker UI is not supported for embedding directly. Please use List
            or Grid mode.
          </div>
        );
      }

      return (
        <div className="w-full aspect-video bg-white dark:bg-black border-2 rounded-xl overflow-hidden">
          <iframe
            src={embedUrl}
            className="w-full h-full"
            title="Google Drive Folder View"
            frameBorder="0"
          ></iframe>
        </div>
      );
    }

    case QUESTION_TYPES.CALENDLY:
      return (
        <div className="w-full h-[400px]">
          <iframe
            src={config.calendlyUrl}
            width="100%"
            height="100%"
            frameBorder="0"
            className="rounded-xl border-2"
            title="Calendly Scheduler"
          ></iframe>
        </div>
      );

    case QUESTION_TYPES.END_SCREEN:
      return <div>{config.text}</div>;
    case QUESTION_TYPES.RANKING:
      const [items, setItems] = useState(config.items || []);

      const sensors = useSensors(useSensor(PointerSensor));

      return (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={(event) => {
            const { active, over } = event;
            if (active.id !== over.id) {
              const oldIndex = items.indexOf(active.id);
              const newIndex = items.indexOf(over.id);
              const newItems = arrayMove(items, oldIndex, newIndex);
              setItems(newItems);
              onChange(newItems);
            }
          }}
        >
          <SortableContext items={items} strategy={verticalListSortingStrategy}>
            <ul className="space-y-2">
              {items.map((item, index) => (
                <SortableItem key={item} id={item} />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      );

    case QUESTION_TYPES.OPINION_SCALE: {
      const min = config.min ?? 1;
      const max = config.max ?? 5;
      const minLabel = config.minLabel || "Strongly Disagree";
      const maxLabel = config.maxLabel || "Strongly Agree";

      return (
        <div className="space-y-4 text-center">
          {/* Labels */}
          <div className="flex justify-between text-sm text-gray-600 dark:text-yellow-200 px-1">
            <span>{minLabel}</span>
            <span>{maxLabel}</span>
          </div>

          {/* Scale */}
          <div className="flex justify-center gap-2 sm:gap-3 flex-wrap">
            {Array.from({ length: max - min + 1 }, (_, i) => min + i).map(
              (val) => (
                <button
                  key={val}
                  onClick={() => onChange(val)}
                  className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-orange-400 ${
                    value === val
                      ? "bg-orange-500 text-white shadow-md"
                      : "bg-orange-100 dark:bg-gray-700 text-gray-800 dark:text-[#96949C] hover:bg-orange-200 dark:hover:bg-gray-600"
                  }`}
                >
                  {val}
                </button>
              )
            )}
          </div>
        </div>
      );
    }

    case QUESTION_TYPES.NPS:
      return (
        <div className="text-center space-y-4">
          <div className="flex justify-between text-sm text-gray-600 dark:text-yellow-200">
            <span>{config.minLabel}</span>
            <span>{config.maxLabel}</span>
          </div>
          <div className="flex justify-center gap-2">
            {Array.from({ length: 11 }, (_, i) => i).map((score) => (
              <button
                key={score}
                className={`w-12 h-12 rounded-full text-sm font-semibold ${
                  value === score
                    ? "bg-orange-500 text-white"
                    : "bg-orange-100 dark:bg-gray-700 text-gray-800 dark:text-[#96949C]"
                }`}
                onClick={() => onChange(score)}
              >
                {score}
              </button>
            ))}
          </div>
        </div>
      );

    case QUESTION_TYPES.MATRIX: {
      const columns = config.columns || config.cols || [];
      const rows = config.rows || [];
      const [matrixAnswers, setMatrixAnswers] = useState({});

      const handleMatrixChange = (rowLabel, colLabel, checked) => {
        setMatrixAnswers((prev) => ({
          ...prev,
          [rowLabel]:
            config.type === "checkbox"
              ? checked
                ? [...(prev[rowLabel] || []), colLabel]
                : (prev[rowLabel] || []).filter((c) => c !== colLabel)
              : colLabel,
        }));

        onChange({
          type: "matrix",
          value: {
            ...matrixAnswers,
            [rowLabel]:
              config.type === "checkbox"
                ? checked
                  ? [...(matrixAnswers[rowLabel] || []), colLabel]
                  : (matrixAnswers[rowLabel] || []).filter(
                      (c) => c !== colLabel
                    )
                : colLabel,
          },
        });
      };

      return (
        <div className="space-y-4">
          <div className="overflow-x-auto rounded-xl shadow-xl">
            <table className="min-w-full text-sm text-left ">
              <thead className="bg-[#FFEEDF] rounded-xl dark:bg-gray-700">
                <tr>
                  <th className="p-3 font-medium text-gray-700 dark:text-[#96949C]">
                    &nbsp;
                  </th>
                  {columns.map((col, idx) => (
                    <th
                      key={idx}
                      className="p-3 text-xs font-normal text-center text-nowrap text-gray-700 dark:text-[#96949C]"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, rowIndex) => (
                  <tr
                    key={rowIndex}
                    className="border-t border-gray-200 dark:border-gray-600"
                  >
                    <td className="p-3 text-xs text-nowrap text-gray-800 dark:text-[#96949C]">
                      {row}
                    </td>
                    {columns.map((col, colIndex) => {
                      const isChecked =
                        config.type === "checkbox"
                          ? matrixAnswers[row]?.includes(col)
                          : matrixAnswers[row] === col;

                      return (
                        <td key={colIndex} className="p-3 text-center">
                          <label className="inline-flex items-center justify-center cursor-pointer">
                            <input
                              type={
                                config.type === "checkbox"
                                  ? "checkbox"
                                  : "radio"
                              }
                              name={
                                config.type === "checkbox"
                                  ? `${rowIndex}-${colIndex}`
                                  : `${rowIndex}`
                              }
                              value={col}
                              checked={!!isChecked}
                              onChange={(e) =>
                                handleMatrixChange(row, col, e.target.checked)
                              }
                              className="hidden peer"
                            />
                            <div className="w-6 h-6 rounded border border-[#8C8A97] bg-white peer-checked:bg-orange-500 flex items-center justify-center transition-colors duration-200">
                              <svg
                                className={`w-4 h-4 text-white ${
                                  isChecked ? "block" : "hidden"
                                }`}
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="3"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M5 13l4 4L19 7"
                                />
                              </svg>
                            </div>
                          </label>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );

      return (
        <div className="space-y-4">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm text-left border border-gray-300 dark:border-gray-600">
              <thead className="bg-gray-100 dark:bg-gray-700">
                <tr>
                  <th className="p-3 font-medium text-gray-700 dark:text-[#96949C]">
                    &nbsp;
                  </th>
                  {config.columns?.map((col, idx) => (
                    <th
                      key={idx}
                      className="p-3 font-medium text-gray-700 dark:text-[#96949C]"
                    >
                      {col || `Col ${idx + 1}`}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {config.rows?.map((row, rowIndex) => (
                  <tr
                    key={rowIndex}
                    className="border-t border-gray-200 dark:border-gray-600"
                  >
                    <td className="p-3 font-semibold text-gray-800 dark:text-[#96949C]">
                      {row || `Row ${rowIndex + 1}`}
                    </td>
                    {config.columns?.map((col, colIndex) => {
                      const isChecked =
                        config.type === "checkbox"
                          ? matrixAnswers[row]?.includes(col)
                          : matrixAnswers[row] === col;

                      return (
                        <td key={colIndex} className="p-3 text-center">
                          <input
                            type={
                              config.type === "checkbox" ? "checkbox" : "radio"
                            }
                            name={
                              config.type === "checkbox"
                                ? `${question.questionId}-${rowIndex}-${colIndex}`
                                : `${question.questionId}-${rowIndex}`
                            }
                            value={col}
                            checked={!!isChecked}
                            onChange={(e) =>
                              handleMatrixChange(row, col, e.target.checked)
                            }
                            className="accent-orange-500"
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    case QUESTION_TYPES.WELCOME:
      return (
        <div className="text-center">
          <h2 className="text-3xl font-bold mb-2">{config.title}</h2>
          <p className="text-lg text-gray-600 dark:text-yellow-200">
            {config.description}
          </p>
        </div>
      );

    case QUESTION_TYPES.REDIRECT:
      return (
        <div className="text-center">
          <p className="text-sm text-gray-700 dark:text-[#96949C] mb-2">
            After completing this step, you'll be redirected to:
          </p>
          <a
            href={config.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-orange-600 dark:text-orange-400 underline break-all"
          >
            {config.url || "No URL configured"}
          </a>
        </div>
      );

    case QUESTION_TYPES.END_SCREEN:
      return (
        <div className="text-center">
          <h2 className="text-3xl font-bold text-green-600 dark:text-green-400">
            {config.title}
          </h2>
          <p className="mt-2 text-lg text-gray-700 dark:text-yellow-200">
            {config.description}
          </p>
        </div>
      );

    default:
      return (
        <p className="p-4 rounded-xl text-center text-gray-500 dark:text-yellow-300">
          Unsupported question type: {questionType}
        </p>
      );
  }
}
