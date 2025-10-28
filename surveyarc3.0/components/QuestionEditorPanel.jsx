"use client";
import React, { useEffect, useState } from "react";
import { Plus, Type } from "lucide-react";
import QUESTION_TYPES from "@/enums/questionTypes";
import QuestionConfigForm from "./QuestionFrom";
import { ICONS_MAP } from "@/utils/questionTypes";

export default function QuestionEditorPanel({
  selectedQuestion,
  selectedType,
  setSelectedType,
  setSelectedQuestionIndex,
  newQuestionData,
  setNewQuestionData,
  updateConfig,
  handleAddQuestion,
  handleUpdateQuestion,
  addingQuestion,
}) {
  const [editableQuestion, setEditableQuestion] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!selectedQuestion) return;
    if (selectedQuestion.questionId !== editableQuestion?.questionId) {
      setEditableQuestion({ ...selectedQuestion });
    }
  }, [selectedQuestion?.questionId]);

  const isEditMode = Boolean(editableQuestion);

  const nextFrame = () =>
    new Promise((resolve) => requestAnimationFrame(() => resolve()));

  const getIconForType = (type) => {
    if (!type) return <Type className="w-5 h-5" />;
    if (ICONS_MAP[type]) return ICONS_MAP[type];
    const enumKey = Object.keys(QUESTION_TYPES).find(
      (k) => QUESTION_TYPES[k] === type || k === type
    );
    if (enumKey && ICONS_MAP[enumKey]) return ICONS_MAP[enumKey];
    return <Type className="w-5 h-5" />;
  };

  const normalizedUpdateConfig = (keyOrObject, value) => {
    if (isEditMode) {
      if (typeof keyOrObject === "object") {
        setEditableQuestion((prev) => ({ ...prev, config: keyOrObject }));
      } else {
        setEditableQuestion((prev) => ({
          ...prev,
          config: { ...(prev?.config || {}), [keyOrObject]: value },
        }));
      }
    } else {
      updateConfig(keyOrObject, value);
    }
  };

  const isScreenType = (t) =>
    ["welcome_screen", "end_screen", "redirect_screen"].includes(t);
  const createDisabled = () =>
    saving ||
    addingQuestion ||
    (!isScreenType(selectedType) && !(newQuestionData?.label || "").trim());

  const editDisabled = () =>
    saving ||
    addingQuestion ||
    !(
      isScreenType(editableQuestion?.type) ||
      (editableQuestion?.label && String(editableQuestion.label).trim())
    );

  const onCreateClick = async () => {
    if (saving || addingQuestion) return;
    try {
      setSaving(true);
      await nextFrame();

      await Promise.resolve(handleAddQuestion());

      setNewQuestionData({ label: "", description: "", config: {} });
    } catch (err) {
      console.error("Add question failed:", err);
      alert(err?.message || "Failed to add question");
    } finally {
      setSaving(false);
    }
  };

  const onUpdateClick = async () => {
    if (!editableQuestion) return;
    if (saving) return;
    try {
      setSaving(true);
      await nextFrame();
      await Promise.resolve(
        handleUpdateQuestion(editableQuestion.questionId, editableQuestion)
      );
      setEditableQuestion(null);
      setSelectedQuestionIndex(null);
      setSelectedType(null);
    } catch (err) {
      console.error("Update question failed:", err);
      alert(err?.message || "Failed to save changes");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="flex-1 p-8 dark:bg-[#121214] bg-[#F5F5F5]">
      {isEditMode ? (
        <div className="animate-in slide-in-from-right duration-500 ease-out">
          <EditorCard
            title={`Edit ${String(editableQuestion?.type || "").replaceAll(
              "_",
              " "
            )}`}
            icon={getIconForType(editableQuestion?.type)}
          >
            {!["end_screen", "welcome_screen"].includes(
              editableQuestion?.type
            ) && (
              <>
                <div className="animate-in slide-in-from-bottom duration-300 delay-100">
                  <LabeledInput
                    label="Question Label *"
                    value={editableQuestion?.label || ""}
                    onChange={(e) =>
                      setEditableQuestion((prev) => ({
                        ...prev,
                        label: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="animate-in slide-in-from-bottom duration-300 delay-200">
                  <LabeledInput
                    label="Description"
                    value={editableQuestion?.description || ""}
                    onChange={(e) =>
                      setEditableQuestion((prev) => ({
                        ...prev,
                        description: e.target.value,
                      }))
                    }
                  />
                </div>
              </>
            )}

            <div className="rounded-lg bg-white/40 backdrop-blur-sm animate-in slide-in-from-bottom duration-300 delay-300">
              <QuestionConfigForm
                type={editableQuestion?.type}
                config={editableQuestion?.config || {}}
                updateConfig={normalizedUpdateConfig}
              />
            </div>

            <div className="flex gap-3 pt-4 animate-in slide-in-from-bottom duration-300 delay-400">
              <button
                onClick={() => {
                  setEditableQuestion(null);
                  setSelectedQuestionIndex(null);
                  setSelectedType(null);
                }}
                className="flex-1 px-4 py-2.5 rounded-lg font-medium transition-all duration-300 border-2 border-slate-300 text-slate-600 bg-white/60 backdrop-blur-sm hover:bg-white/80 hover:border-slate-400 hover:shadow-md transform hover:scale-[1.02] active:scale-[0.98] text-sm"
                disabled={saving}
              >
                Cancel
              </button>

              <button
                onClick={onUpdateClick}
                className="flex-1 px-4 py-2.5 rounded-lg font-medium transition-all duration-300 bg-[#ED7A13] text-white shadow-md hover:shadow-lg transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none text-sm"
                disabled={editDisabled()}
              >
                {saving ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Saving...
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2">
                    Update Changes
                  </div>
                )}
              </button>
            </div>
          </EditorCard>
        </div>
      ) : selectedType ? (
        <div className="animate-in slide-in-from-left duration-500 ease-out">
          <EditorCard
            title={`Configure ${String(selectedType).replaceAll("_", " ")}`}
            icon={getIconForType(selectedType)}
          >
            {isScreenType(selectedType) && (
              <p className="text-xs text-gray-500 mt-2">
                Label / description are optional for screen types.
              </p>
            )}

            {!["end_screen", "welcome_screen"].includes(selectedType) && (
              <>
                <div className="animate-in slide-in-from-bottom duration-300 delay-100">
                  <LabeledInput
                    label="Question Label *"
                    value={newQuestionData?.label || ""}
                    onChange={(e) =>
                      setNewQuestionData((prev) => ({
                        ...prev,
                        label: e.target.value,
                      }))
                    }
                    placeholder="Enter your question here..."
                  />
                </div>

                <div className="animate-in slide-in-from-bottom duration-300 delay-200">
                  <LabeledInput
                    label="Description (Optional)"
                    value={newQuestionData?.description || ""}
                    onChange={(e) =>
                      setNewQuestionData((prev) => ({
                        ...prev,
                        description: e.target.value,
                      }))
                    }
                    placeholder="Add helpful context or instructions..."
                  />
                </div>
              </>
            )}

            <div className="rounded-xl bg-white/40 backdrop-blur-sm animate-in slide-in-from-bottom duration-300 delay-300">
              <QuestionConfigForm
                type={selectedType}
                config={newQuestionData?.config || {}}
                updateConfig={normalizedUpdateConfig}
              />
            </div>

            <SaveCancelRow
              onCancel={() => {
                setSelectedType(null);
                setNewQuestionData({ label: "", description: "", config: {} });
              }}
              onSave={onCreateClick}
              saveLabel="Save Question"
              cancelDisabled={saving}
              saveDisabled={createDisabled()}
            />
          </EditorCard>
        </div>
      ) : (
        <PlaceholderCreate />
      )}
    </main>
  );
}


function EditorCard({ title, icon, children }) {
  return (
    <div className="mx-auto rounded-xl p-6 shadow-xl space-y-6 overflow-y-auto h-[77vh] dark:bg-[#1A1A1E] bg-white dark:border-none border border-white/60 animate-in zoom-in-95 duration-300">
      <div className="text-center mb-6 animate-in slide-in-from-top duration-300">
        <div className="flex items-center gap-5">
          <div className="relative inline-block">
            <div className="w-14 h-14 mx-auto mb-4 rounded-xl border flex items-center justify-center shadow-xl transform hover:scale-110 transition-all duration-300">
              <span className="text-lg text-white">{icon}</span>
            </div>
          </div>
          <div className="text-xl dark:text-[#CBC9DE] text-black capitalize">
            {title}
          </div>
        </div>
      </div>
      <div className="space-y-6">{children}</div>
    </div>
  );
}

function LabeledInput({ label, value, onChange, placeholder = "" }) {
  return (
    <div className="space-y-2">
      <label className="block dark:text-[#96949C] text-black text-sm">
        {label}
      </label>
      <div className="relative">
        <input
          type="text"
          className="w-full px-4 py-3 rounded-lg border dark:text-[#CBC9DE] border-[#8C8A97] dark:bg-[#1A1A1E] bg-white/80 backdrop-blur-sm text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none transition-all duration-300 shadow-sm hover:shadow-md"
          value={value}
          onChange={onChange}
          placeholder={placeholder}
        />
        <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-blue-400/10 to-indigo-400/10 pointer-events-none opacity-0 transition-opacity duration-300 hover:opacity-100"></div>
      </div>
    </div>
  );
}

function SaveCancelRow({
  onCancel,
  onSave,
  saveLabel,
  cancelDisabled,
  saveDisabled,
}) {
  const extraBtnClass = saveDisabled ? "pointer-events-none opacity-70" : "";
  return (
    <div className="flex gap-4 pt-6 animate-in slide-in-from-bottom duration-300 delay-400">
      <button
        onClick={onCancel}
        className="flex-1 px-6 py-3 rounded-xl font-semibold dark:text-[#96949C] border-2 dark:bg-[#1A1A1E] border-slate-300 text-slate-600 bg-white/60 backdrop-blur-sm hover:bg-white/80 hover:border-slate-400 hover:shadow-lg transform hover:scale-[1.02] active:scale-[0.98] transition-all duration-300"
        disabled={cancelDisabled}
      >
        Cancel
      </button>

      <button
        onClick={onSave}
        aria-busy={saveDisabled ? "true" : "false"}
        className={`flex-1 px-6 py-3 rounded-xl font-semibold transition-all duration-300 bg-[#ED7A13] text-white shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none ${extraBtnClass}`}
        disabled={saveDisabled}
      >
        <div className="flex items-center justify-center gap-2">
          {saveDisabled ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Saving...</span>
            </>
          ) : (
            <>{saveLabel}</>
          )}
        </div>
      </button>
    </div>
  );
}

function PlaceholderCreate() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center animate-in fade-in duration-700">
      <div className="relative mb-8">
        <div className="w-32 h-32 mx-auto rounded-full bg-gradient-to-br from-blue-100 via-indigo-100 to-purple-100 flex items-center justify-center shadow-2xl animate-in zoom-in duration-500 delay-200">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg transform hover:scale-105 transition-transform duration-300">
            <Plus className="w-12 h-12 text-white" />
          </div>
        </div>
        <div className="absolute -top-4 -right-4 w-8 h-8 bg-gradient-to-r from-pink-400 to-purple-500 rounded-full animate-bounce delay-1000" />
        <div className="absolute -bottom-2 -left-6 w-6 h-6 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full animate-bounce delay-1500" />
      </div>

      <div className="animate-in slide-in-from-bottom duration-500 delay-300">
        <h3 className="text-3xl font-bold mb-4 dark:text-[#CBC9DE] text-black">
          Ready to Create Questions?
        </h3>
        <p className="text-xl mb-8 dark:text-[#96949C] text-slate-600 max-w-md leading-relaxed">
          Select "Add New Question" to get started with your survey
        </p>
      </div>

      <div className="animate-in slide-in-from-bottom duration-500 delay-500">
        <div className="flex flex-col sm:flex-row gap-4 items-center">
          <div className="px-4 py-2 bg-white/60 backdrop-blur-sm rounded-full text-sm text-slate-600 border border-white/80">
            💡 Choose from multiple question types
          </div>
          <div className="px-4 py-2 bg-white/60 backdrop-blur-sm rounded-full text-sm text-slate-600 border border-white/80">
            ⚙️ Configure advanced options
          </div>
        </div>
      </div>
    </div>
  );
}
