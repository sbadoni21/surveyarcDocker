"use client";
import React, { useEffect, useRef, useState } from "react";
import { Plus, Type } from "lucide-react";
import QUESTION_TYPES from "@/enums/questionTypes";
import QuestionConfigForm from "./QuestionFrom";
import { ICONS_MAP } from "@/utils/questionTypes";

export default function QuestionEdritorPanel({
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
  onDirtyChange,
  saveRequestCounter,
  onSaved,
  surveyId,
  orgId,
}) {
  const [editableQuestion, setEditableQuestion] = useState(null);
  const [saving, setSaving] = useState(false);

  const [dirty, setDirty] = useState(false);
  const lastSaveRequest = useRef(saveRequestCounter);

  useEffect(() => {
    if (!selectedQuestion) return;
    if (selectedQuestion.questionId !== editableQuestion?.questionId) {
      setEditableQuestion({ ...selectedQuestion });
      setDirty(false);
      onDirtyChange?.(false);
    }
  }, [selectedQuestion?.questionId]);

  useEffect(() => {
    if (!selectedType) return;
    if (!editableQuestion) {
      setDirty(false);
      onDirtyChange?.(false);
    }
  }, [selectedType]);

  useEffect(() => {
    onDirtyChange?.(Boolean(dirty));
  }, [dirty]);

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
    setDirty(true);
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

  useEffect(() => {
    if (typeof saveRequestCounter === "undefined") return;
    if (lastSaveRequest.current === saveRequestCounter) return;
    lastSaveRequest.current = saveRequestCounter;

    (async () => {
      if (saving) return;
      if (isEditMode) {
        await onUpdateClick(true);
      } else {
        await onCreateClick(true);
      }
    })();
  }, [saveRequestCounter]);

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

  const onCreateClick = async (autoMode = false) => {
    if (saving || addingQuestion) return;
    try {
      setSaving(true);
      await nextFrame();
      await Promise.resolve(handleAddQuestion());
      setNewQuestionData({ label: "", description: "", config: {} });
      setDirty(false);
      onDirtyChange?.(false);
      onSaved?.();
      return { ok: true };
    } catch (err) {
      console.error("Add question failed:", err);
      if (!autoMode) alert(err?.message || "Failed to add question");
      throw err;
    } finally {
      setSaving(false);
    }
  };

  const onUpdateClick = async (autoMode = false) => {
    if (!editableQuestion) return;
    if (saving) return;
    try {
      setSaving(true);
      await nextFrame();

      // Ensure config is properly structured
      const questionToUpdate = {
        ...editableQuestion,
        config: editableQuestion.config || {},
      };

      console.log("=== UPDATING QUESTION ===");
      console.log(
        "Full question data:",
        JSON.stringify(questionToUpdate, null, 2)
      );
      console.log("Config object:", questionToUpdate.config);
      console.log("=========================");

      await Promise.resolve(
        handleUpdateQuestion(editableQuestion.questionId, questionToUpdate)
      );
      setEditableQuestion(null);
      setSelectedQuestionIndex(null);
      setSelectedType(null);
      setDirty(false);
      onDirtyChange?.(false);
      onSaved?.();
      return { ok: true };
    } catch (err) {
      console.error("Update question failed:", err);
      if (!autoMode) alert(err?.message || "Failed to save changes");
      throw err;
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async () => {
    if (dirty) {
      const save = window.confirm(
        "You have unsaved changes. Click OK to save changes, or Cancel to discard."
      );
      if (save) {
        if (isEditMode) {
          await onUpdateClick();
        } else {
          await onCreateClick();
        }
        return;
      } else {
        if (isEditMode) {
          setEditableQuestion(null);
          setSelectedQuestionIndex(null);
        } else {
          setSelectedType(null);
          setNewQuestionData({ label: "", description: "", config: {} });
        }
        setDirty(false);
        onDirtyChange?.(false);
        return;
      }
    } else {
      if (isEditMode) {
        setEditableQuestion(null);
        setSelectedQuestionIndex(null);
        setSelectedType(null);
      } else {
        setSelectedType(null);
        setNewQuestionData({ label: "", description: "", config: {} });
      }
    }
  };

  const onLabelChange = (value) => {
    if (isEditMode) {
      setEditableQuestion((prev) => ({ ...prev, label: value }));
    } else {
      setNewQuestionData((prev) => ({ ...prev, label: value }));
    }
    setDirty(true);
  };

  const onDescriptionChange = (value) => {
    if (isEditMode) {
      setEditableQuestion((prev) => ({ ...prev, description: value }));
    } else {
      setNewQuestionData((prev) => ({ ...prev, description: value }));
    }
    setDirty(true);
  };

  const onSerialLabelChange = (value) => {
    const clean = value ?? "";

    if (isEditMode) {
      setEditableQuestion((prev) => ({
        ...prev,
        serial_label: clean,
      }));
    } else {
      setNewQuestionData((prev) => ({
        ...prev,
        serial_label: clean,
      }));
    }

    setDirty(true);
  };

  return (
    <main className="flex-1 dark:bg-[#121214] bg-[#F5F5F5] ">
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
                <div className="animate-in slide-in-from-bottom duration-300 delay-50">
                  <LabeledInput
                    label="Question Label (Serial / Decipher)"
                    value={editableQuestion?.serial_label || ""}
                    onChange={(e) => onSerialLabelChange(e.target.value)}
                    placeholder="e.g. Q1, A2, S12"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Used for logic, exports & referencing (must be unique per
                    survey)
                  </p>
                </div>

                <div className="animate-in slide-in-from-bottom duration-300 delay-100">
                  <LabeledInput
                    label="Question Label *"
                    value={editableQuestion?.label || ""}
                    onChange={(e) => onLabelChange(e.target.value)}
                  />
                </div>
                <div className="animate-in slide-in-from-bottom duration-300 delay-200">
                  <LabeledInput
                    label="Description"
                    value={editableQuestion?.description || ""}
                    onChange={(e) => onDescriptionChange(e.target.value)}
                  />
                </div>
              </>
            )}

            <div className="rounded-lg bg-white/40 backdrop-blur-sm animate-in slide-in-from-bottom duration-300 delay-300">
              <QuestionConfigForm
                type={editableQuestion?.type}
                config={editableQuestion?.config || {}}
                updateConfig={normalizedUpdateConfig}
                surveyId={surveyId}
                orgId={orgId}
                questionId={editableQuestion?.questionId}
              />
            </div>

            <SaveCancelRow
              onCancel={handleCancel}
              onSave={() => onUpdateClick(false)}
              saveLabel="Update Changes"
              cancelDisabled={saving}
              saveDisabled={editDisabled()}
              isSaving={saving}
            />
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
                <div className="animate-in slide-in-from-bottom duration-300 delay-50">
                  <LabeledInput
                    label="Question Label (Serial / Decipher)"
                    value={newQuestionData?.serial_label || ""}
                    onChange={(e) => onSerialLabelChange(e.target.value)}
                    placeholder="Auto-generated if left empty"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Optional. Example: Q1, Q2, A1
                  </p>
                </div>

                <div className="animate-in slide-in-from-bottom duration-300 delay-100">
                  <LabeledInput
                    label="Question Label *"
                    value={newQuestionData?.label || ""}
                    onChange={(e) => onLabelChange(e.target.value)}
                    placeholder="Enter your question here..."
                  />
                </div>

                <div className="animate-in slide-in-from-bottom duration-300 delay-200">
                  <LabeledInput
                    label="Description (Optional)"
                    value={newQuestionData?.description || ""}
                    onChange={(e) => onDescriptionChange(e.target.value)}
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
                surveyId={surveyId}
                orgId={orgId}
                questionId={newQuestionData?.questionId}
              />
            </div>

            <SaveCancelRow
              onCancel={handleCancel}
              onSave={() => onCreateClick(false)}
              saveLabel="Save Question"
              cancelDisabled={saving}
              saveDisabled={createDisabled()}
              isSaving={saving}
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
    <div className="mx-auto  rounded p-6 shadow-xl space-y-6 overflow-y-auto h-[80vh] dark:bg-[#1A1A1E] bg-white dark:border-none border  animate-in zoom-in-95 duration-300">
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
  isSaving = false,
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
        aria-busy={isSaving ? "true" : "false"}
        className={`flex-1 px-6 py-3 rounded-xl font-semibold transition-all duration-300 bg-[#ED7A13] text-white shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none ${extraBtnClass}`}
        disabled={saveDisabled || isSaving}
      >
        <div className="flex items-center justify-center gap-2">
          {isSaving ? (
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
