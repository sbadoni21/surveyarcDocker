"use client";
import React, { useState, useEffect } from 'react';
import { Search, Languages, Save, X, Loader2, Plus, Download, Upload, Check } from 'lucide-react';
import { useQuestion } from '@/providers/questionPProvider';
import { AVAILABLE_LANGUAGES } from '@/utils/availableLanguages';
import { usePathname } from 'next/navigation';

// ============================================
// LANGUAGE SELECTION MODAL COMPONENT
// ============================================
function LanguageSelectionModal({ isOpen, onClose, availableLanguages, onDownload }) {
  const [selectedLanguages, setSelectedLanguages] = useState(new Set(availableLanguages));
  const [format, setFormat] = useState('csv');

  useEffect(() => {
    // Reset selections when modal opens
    if (isOpen) {
      setSelectedLanguages(new Set(availableLanguages));
    }
  }, [isOpen, availableLanguages]);

  if (!isOpen) return null;

  const toggleLanguage = (lang) => {
    setSelectedLanguages(prev => {
      const updated = new Set(prev);
      if (updated.has(lang)) {
        updated.delete(lang);
      } else {
        updated.add(lang);
      }
      return updated;
    });
  };

  const selectAll = () => {
    setSelectedLanguages(new Set(availableLanguages));
  };

  const deselectAll = () => {
    setSelectedLanguages(new Set());
  };

  const handleDownload = () => {
    if (selectedLanguages.size === 0) {
      alert('Please select at least one language');
      return;
    }
    onDownload(Array.from(selectedLanguages), format);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">Download Translations</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-4 overflow-y-auto flex-1">
          {/* Format Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Export Format
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  value="csv"
                  checked={format === 'csv'}
                  onChange={(e) => setFormat(e.target.value)}
                  className="w-4 h-4 text-blue-600"
                />
                <span className="text-sm">CSV (Recommended for Excel/Google Sheets)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  value="json"
                  checked={format === 'json'}
                  onChange={(e) => setFormat(e.target.value)}
                  className="w-4 h-4 text-blue-600"
                />
                <span className="text-sm">JSON</span>
              </label>
            </div>
          </div>

          {/* Language Selection */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-gray-700">
                Select Languages to Export
              </label>
              <div className="flex gap-2">
                <button
                  onClick={selectAll}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                >
                  Select All
                </button>
                <span className="text-gray-400">|</span>
                <button
                  onClick={deselectAll}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                >
                  Deselect All
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 max-h-96 overflow-y-auto border border-gray-200 rounded-lg p-4">
              {availableLanguages.map(lang => {
                const langInfo = AVAILABLE_LANGUAGES.find(l => l.code === lang) || { 
                  flag: '🏴', 
                  name: lang 
                };
                const isSelected = selectedLanguages.has(lang);

                return (
                  <label
                    key={lang}
                    className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                      isSelected 
                        ? 'border-blue-500 bg-blue-50' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleLanguage(lang)}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                    <span className="text-2xl">{langInfo.flag}</span>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-900">{langInfo.name}</div>
                      <div className="text-xs text-gray-500">{lang}</div>
                    </div>
                    {isSelected && (
                      <Check className="w-4 h-4 text-blue-600" />
                    )}
                  </label>
                );
              })}
            </div>

            <div className="mt-3 text-sm text-gray-600">
              {selectedLanguages.size} {selectedLanguages.size === 1 ? 'language' : 'languages'} selected
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleDownload}
            disabled={selectedLanguages.size === 0}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Download {format.toUpperCase()}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TranslationUI() {
  const { 
    questions, 
    surveyId,
    getAllQuestions,
    updateQuestionTranslation 
  } = useQuestion();
  const path = usePathname();
  const orgId = path.split("/")[3];
  
  const [searchTerm, setSearchTerm] = useState('');
  const [editingCells, setEditingCells] = useState({});
  const [editValues, setEditValues] = useState({});
  const [loading, setLoading] = useState(false);
  const [savingCells, setSavingCells] = useState(new Set());
  const [expandedQuestions, setExpandedQuestions] = useState(new Set());
  const [uploadingFile, setUploadingFile] = useState(false);
  const [showLanguageModal, setShowLanguageModal] = useState(false);

  useEffect(() => {
    if (surveyId && orgId) {
      loadQuestions();
    }
  }, [surveyId, orgId]);

  const loadQuestions = async () => {
    setLoading(true);
    try {
      await getAllQuestions(orgId, surveyId);
    } catch (error) {
      console.error('Error loading questions:', error);
    } finally {
      setLoading(false);
    }
  };

  // Debug: Log questions to console
  useEffect(() => {
    if (questions.length > 0) {
      console.log('Loaded questions:', questions);
      const invalidQuestions = questions.filter(q => !q.questionId || q.questionId === 'undefined');
      if (invalidQuestions.length > 0) {
        console.warn('Found questions with invalid questionId:', invalidQuestions);
      }
    }
  }, [questions]);

  // Get all available languages from translations
  const getAvailableLanguages = () => {
    const languages = new Set(['en']); // Always include English
    questions.forEach(question => {
      if (question.translations) {
        Object.keys(question.translations).forEach(lang => languages.add(lang));
      }
    });
    return Array.from(languages).sort();
  };

  const availableLanguages = getAvailableLanguages();

  // Helper function to safely display values (handle objects/arrays)
  const formatValueForDisplay = (value) => {
    if (value === null || value === undefined || value === '') {
      return '';
    }
    
    // If it's an object or array, stringify it for display
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    
    return String(value);
  };

  // Helper function to check if a value is a complex object/array
  const isComplexValue = (value) => {
    return value !== null && typeof value === 'object';
  };


const getTranslationValue = (question, field, subfield, locale) => {
  // Helper to get nested value from object using path
  const getNestedValue = (obj, path) => {
    if (!path) return obj;
    
    // Handle array notation: items[0] or options[0].label
    const arrayMatch = path.match(/^(\w+)\[(\d+)\](?:\.(\w+))?$/);
    if (arrayMatch) {
      const [, arrayName, index, prop] = arrayMatch;
      const array = obj?.[arrayName];
      
      if (!Array.isArray(array) || !array[parseInt(index)]) {
        return '';
      }
      
      const item = array[parseInt(index)];
      
      // If no property specified, return the item itself (for string arrays)
      if (!prop) {
        return typeof item === 'string' ? item : '';
      }
      
      // Return the property from object in array
      return typeof item === 'object' ? (item[prop] || '') : '';
    }
    
    // Handle simple nested: config.placeholder or anchors.min
    return path.split('.').reduce((acc, part) => acc?.[part], obj) || '';
  };
  
  // For English (base language), get from main question object
  if (locale === 'en') {
    if (subfield) {
      return getNestedValue(question[field], subfield);
    }
    return question[field] || '';
  }
  
  // For translations, get from translations object
  const translation = question.translations?.[locale];
  if (!translation) return '';
  
  if (subfield) {
    return getNestedValue(translation[field], subfield);
  }
  return translation?.[field] || '';
};

const getFlattenedConfigFields = (config) => {
  const fields = [];
  
  if (!config) return fields;
    const NON_TRANSLATABLE_FIELDS = [
    'numSets',
    'setSize', 
    'randomize',
    'required',
    'minValue',
    'maxValue',
    'step',
    'rows',
    'cols',
    'scale',
    'min',
    'layout',
    'noColor',
    'total',
    'decimalPlaces',
    'noIcon',
    'showIcons',
    'yesColor',
    'yesIcon',
    'max',
    'showLabels',
    'allowMultiple',
    'maxSelections',
    'minSelections'
  ];
  Object.keys(config).forEach(key => {
    const value = config[key];
      if (NON_TRANSLATABLE_FIELDS.includes(key)) {
      return;
    }
    // Handle arrays
    if (Array.isArray(value)) {
      // Array of objects (like options: [{id, label}, ...])
      if (value.length > 0 && typeof value[0] === 'object' && value[0] !== null) {
        value.forEach((option, index) => {
          // Get translatable properties from each object
          Object.keys(option).forEach(prop => {
            // Only include translatable text properties
            if (typeof option[prop] === 'string' && 
                !['id', 'value', 'icon', 'colorTag'].includes(prop)) {
              fields.push({
                key: `${key}[${index}].${prop}`,
                displayKey: `${key}[${index}].${prop}`,
                value: option[prop]
              });
            }
          });
        });
      }
      // Array of strings (like items: ["Battery life", "Camera quality", ...])
      else if (value.length > 0 && typeof value[0] === 'string') {
        value.forEach((item, index) => {
          fields.push({
            key: `${key}[${index}]`,
            displayKey: `${key}[${index}]`,
            value: item
          });
        });
      }
    }
    // Handle simple string/number values
    else if (typeof value === 'string' || typeof value === 'number') {
      fields.push({
        key: key,
        displayKey: key,
        value: value
      });
    }
    // Handle objects (like anchors: {min: "Low", max: "High"})
    else if (typeof value === 'object' && value !== null) {
      Object.keys(value).forEach(subKey => {
        if (typeof value[subKey] === 'string') {
          fields.push({
            key: `${key}.${subKey}`,
            displayKey: `${key}.${subKey}`,
            value: value[subKey]
          });
        }
      });
    }
  });
  
  return fields;
};


 const handleCellClick = (questionId, field, subfield, locale) => {
    if (locale === 'en') return; // Don't allow editing base language
    
    const question = questions.find(q => q.questionId === questionId);
    if (!question) return;
    
    const cellKey = `${questionId}-${field}-${subfield || 'none'}-${locale}`;
    const currentValue = getTranslationValue(question, field, subfield, locale);
    
    // Format the value for editing
    const editableValue = formatValueForDisplay(currentValue);
    
    setEditingCells(prev => ({ ...prev, [cellKey]: true }));
    setEditValues(prev => ({ ...prev, [cellKey]: editableValue }));
  };

const handleSave = async (questionId, field, subfield, locale) => {
  const cellKey = `${questionId}-${field}-${subfield || 'none'}-${locale}`;
  let editValue = editValues[cellKey] || '';

  // Try to parse JSON if it looks like JSON
  if (editValue.trim().startsWith('{') || editValue.trim().startsWith('[')) {
    try {
      editValue = JSON.parse(editValue);
    } catch (e) {
      // If parsing fails, keep as string
    }
  }

  setSavingCells(prev => new Set(prev).add(cellKey));
  
  try {
    const question = questions.find(q => q.questionId === questionId);
    if (!question) {
      throw new Error('Question not found');
    }

    // Get existing translation or create new
    const existingTranslation = question.translations?.[locale] || {};

    // Deep clone config to avoid mutations
    const mergedConfig = JSON.parse(JSON.stringify(question.config || {}));
    
    // Merge existing translation config
    if (existingTranslation.config) {
      Object.keys(existingTranslation.config).forEach(key => {
        mergedConfig[key] = existingTranslation.config[key];
      });
    }

    // Build complete translation data
    const translationData = {
      label: existingTranslation.label || question.label || '',
      description: existingTranslation.description || question.description || '',
      config: mergedConfig
    };

    // Update the specific field - HANDLE NESTED PATHS
    if (subfield) {
      // Handle array notation: items[0] or options[0].label
      const arrayMatch = subfield.match(/^(\w+)\[(\d+)\](?:\.(\w+))?$/);
      if (arrayMatch) {
        const [, arrayName, index, prop] = arrayMatch;
        const idx = parseInt(index);
        
        // Ensure array exists
        if (!translationData.config[arrayName]) {
          translationData.config[arrayName] = [];
        }
        
        // Ensure array is large enough
        while (translationData.config[arrayName].length <= idx) {
          translationData.config[arrayName].push(prop ? {} : '');
        }
        
        if (prop) {
          // Array of objects: options[0].label
          if (typeof translationData.config[arrayName][idx] !== 'object') {
            translationData.config[arrayName][idx] = {};
          }
          translationData.config[arrayName][idx][prop] = editValue;
        } else {
          // Array of strings: items[0]
          translationData.config[arrayName][idx] = editValue;
        }
      }
      // Handle nested objects: anchors.min
      else if (subfield.includes('.')) {
        const [parentKey, childKey] = subfield.split('.');
        if (!translationData.config[parentKey]) {
          translationData.config[parentKey] = {};
        }
        translationData.config[parentKey][childKey] = editValue;
      }
      // Simple config field: placeholder
      else {
        translationData.config[subfield] = editValue;
      }
    } else {
      // Top-level field: label or description
      translationData[field] = editValue;
    }

    console.log('Saving translation:', {
      questionId,
      locale,
      field,
      subfield,
      value: editValue,
      fullData: translationData
    });

    await updateQuestionTranslation(questionId, locale, translationData);
    await getAllQuestions(orgId, surveyId);
    
    setEditingCells(prev => {
      const updated = { ...prev };
      delete updated[cellKey];
      return updated;
    });
    setEditValues(prev => {
      const updated = { ...prev };
      delete updated[cellKey];
      return updated;
    });
  } catch (error) {
    console.error('Error saving translation:', error);
    alert(`Failed to save: ${error.message}`);
  } finally {
    setSavingCells(prev => {
      const updated = new Set(prev);
      updated.delete(cellKey);
      return updated;
    });
  }
};

  const handleCancel = (cellKey) => {
    setEditingCells(prev => {
      const updated = { ...prev };
      delete updated[cellKey];
      return updated;
    });
    setEditValues(prev => {
      const updated = { ...prev };
      delete updated[cellKey];
      return updated;
    });
  };

  const toggleQuestion = (questionId) => {
    setExpandedQuestions(prev => {
      const updated = new Set(prev);
      if (updated.has(questionId)) {
        updated.delete(questionId);
      } else {
        updated.add(questionId);
      }
      return updated;
    });
  };

  const getResourceRows = () => {
    const rows = [];
    
    questions.forEach(question => {
      // Skip questions without proper questionId
      if (!question.questionId || question.questionId === 'undefined') {
        return;
      }

      // Collect all config keys from all translations
      const allConfigKeys = new Set();
      if (question.config) {
        Object.keys(question.config).forEach(key => {
          // Skip complex objects/arrays for translation
          if (!isComplexValue(question.config[key])) {
            allConfigKeys.add(key);
          }
        });
      }
      if (question.translations) {
        Object.values(question.translations).forEach(translation => {
          if (translation.config) {
            Object.keys(translation.config).forEach(key => {
              // Skip complex objects/arrays for translation
              if (!isComplexValue(translation.config[key])) {
                allConfigKeys.add(key);
              }
            });
          }
        });
      }

      // Label
      rows.push({
        questionId: question.questionId,
        field: 'label',
        subfield: null,
        resource: `${question.questionId},label`,
        type: question.type || 'unknown'
      });

      // Description
      rows.push({
        questionId: question.questionId,
        field: 'description',
        subfield: null,
        resource: `${question.questionId},description`,
        type: question.type || 'unknown'
      });
    const configFields = getFlattenedConfigFields(question.config);
      configFields.forEach(({ key, displayKey }) => {
        rows.push({
          questionId: question.questionId,
          field: 'config',
          subfield: key,
          resource: `${question.questionId},config.${displayKey}`,
          type: question.type || 'unknown'
        });
      });
      // Config fields (only simple values)

    });
    
    return rows;
  };

  const filteredRows = getResourceRows().filter(row => {
    if (searchTerm && !row.resource.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }
    return true;
  });

  const isEditing = (questionId, field, subfield, locale) => {
    const cellKey = `${questionId}-${field}-${subfield || 'none'}-${locale}`;
    return editingCells[cellKey];
  };

  const isSaving = (questionId, field, subfield, locale) => {
    const cellKey = `${questionId}-${field}-${subfield || 'none'}-${locale}`;
    return savingCells.has(cellKey);
  };

  const getCellKey = (questionId, field, subfield, locale) => {
    return `${questionId}-${field}-${subfield || 'none'}-${locale}`;
  };

  // ============================================
  // DOWNLOAD TRANSLATIONS WITH LANGUAGE SELECTION
  // ============================================
  const handleDownloadRequest = (selectedLanguages, format) => {
    if (format === 'csv') {
      downloadTranslationsCSV(selectedLanguages);
    } else {
      downloadTranslationsJSON(selectedLanguages);
    }
  };

  const downloadTranslationsCSV = (selectedLanguages) => {
    const rows = getResourceRows();

    // Create CSV header with selected languages only
    const header = ['Resource', 'Type', ...selectedLanguages].join(',');
    
    // Create CSV rows
    const csvRows = rows.map(row => {
      const question = questions.find(q => q.questionId === row.questionId);
      const values = selectedLanguages.map(locale => {
        const value = getTranslationValue(question, row.field, row.subfield, locale);
        let displayValue = formatValueForDisplay(value);
        
        // Don't export empty placeholders - export actual empty string
        if (!displayValue || displayValue === 'empty' || displayValue === 'Click to translate...') {
          displayValue = '';
        }
        
        // Escape quotes and wrap in quotes if contains comma or newline
        return displayValue.includes(',') || displayValue.includes('\n') || displayValue.includes('"')
          ? `"${displayValue.replace(/"/g, '""')}"`
          : displayValue;
      });
      
      // Quote the resource column since it contains a comma
      return [`"${row.resource}"`, row.type, ...values].join(',');
    });

    // Combine header and rows
    const csv = [header, ...csvRows].join('\n');

    // Create blob and download
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    const languageSuffix = selectedLanguages.length === availableLanguages.length 
      ? 'all' 
      : selectedLanguages.join('-');
    link.setAttribute('download', `translations_${surveyId}_${languageSuffix}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadTranslationsJSON = (selectedLanguages) => {
    const translations = {};
    
    questions.forEach(question => {
      translations[question.questionId] = {
        type: question.type,
        label: {},
        description: {},
        config: {}
      };

      selectedLanguages.forEach(locale => {
        translations[question.questionId].label[locale] = 
          getTranslationValue(question, 'label', null, locale);
        translations[question.questionId].description[locale] = 
          getTranslationValue(question, 'description', null, locale);

        // Get all config keys
        const configFields = getFlattenedConfigFields(question.config);
        configFields.forEach(({ key }) => {
          if (!translations[question.questionId].config[key]) {
            translations[question.questionId].config[key] = {};
          }
          translations[question.questionId].config[key][locale] = 
            getTranslationValue(question, 'config', key, locale);
        });
      });
    });

    // Create blob and download
    const json = JSON.stringify(translations, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    const languageSuffix = selectedLanguages.length === availableLanguages.length 
      ? 'all' 
      : selectedLanguages.join('-');
    link.setAttribute('download', `translations_${surveyId}_${languageSuffix}_${new Date().toISOString().split('T')[0]}.json`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ============================================
  // HELPER: Parse CSV line properly (handles quoted values)
  // ============================================
  const parseCSVLine = (line) => {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];
      
      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          current += '"';
          i++; // Skip next quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  // ============================================
  // UPLOAD AND PARSE CSV
  // ============================================
  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingFile(true);

    try {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        throw new Error('File is empty or invalid');
      }

      // Parse header
      const header = parseCSVLine(lines[0]);
      console.log('CSV Header:', header);
      
      const languageColumns = header.slice(2); // Skip 'Resource' and 'Type' columns
      console.log('Language columns found:', languageColumns);
      console.log('Available languages in system:', availableLanguages);

      // Parse data rows
      const updates = [];
      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        
        if (values.length < 3) {
          console.warn(`Skipping line ${i + 1}: Not enough columns`);
          continue;
        }

        const resource = values[0];
        if (!resource || !resource.includes(',')) {
          console.warn(`Skipping line ${i + 1}: Invalid resource format: ${resource}`);
          continue;
        }
        
        const [questionId, fieldPath] = resource.split(',');
        if (!questionId || !fieldPath) {
          console.warn(`Skipping line ${i + 1}: Could not parse questionId/fieldPath from: ${resource}`);
          continue;
        }
        
        // Parse field and subfield
        let field, subfield;
        if (fieldPath.startsWith('config.')) {
          field = 'config';
          subfield = fieldPath.substring(7); // Remove 'config.' prefix
        } else {
          field = fieldPath;
          subfield = null;
        }

        // Get translations for each language
        for (let j = 0; j < languageColumns.length; j++) {
          const locale = languageColumns[j];
          const value = values[j + 2] || ''; // +2 to skip Resource and Type columns

          // Debug log for first data row
          if (i === 1) {
            console.log(`  Column ${j}: locale="${locale}", rawValue="${values[j + 2]}", processedValue="${value}"`);
          }

          // Skip English (base language) and empty/placeholder values
          if (locale === 'en') continue;
          if (!value) continue;
          if (value === 'empty' || value === 'Click to translate...') continue;

          updates.push({
            questionId,
            field,
            subfield,
            locale,
            value
          });
        }
      }

      console.log(`\nParsing complete:`);
      console.log(`  Total data rows: ${lines.length - 1}`);
      console.log(`  Updates to process: ${updates.length}`);
      console.log(`\nFirst 3 updates:`, updates.slice(0, 3));

      if (updates.length === 0) {
        alert('No translations found to update. Make sure your CSV has:\n1. Non-English language columns\n2. Values in those columns\n3. Correct language codes matching your system');
        setUploadingFile(false);
        event.target.value = '';
        return;
      }

      // Batch update all translations
      let successCount = 0;
      let errorCount = 0;
      const errors = [];

      for (const update of updates) {
        try {
          const question = questions.find(q => q.questionId === update.questionId);
          if (!question) {
            console.warn(`Question not found: ${update.questionId}`);
            errorCount++;
            continue;
          }

          const existingTranslation = question.translations?.[update.locale] || {};

          // Deep clone config to avoid mutations
          const mergedConfig = JSON.parse(JSON.stringify(question.config || {}));
          
          // Merge existing translation config
          if (existingTranslation.config) {
            Object.keys(existingTranslation.config).forEach(key => {
              mergedConfig[key] = existingTranslation.config[key];
            });
          }

          const translationData = {
            label: existingTranslation.label || question.label || '',
            description: existingTranslation.description || question.description || '',
            config: mergedConfig
          };

          // Update the specific field - HANDLE NESTED PATHS
          if (update.subfield) {
            // Handle array notation: items[0] or options[0].label
            const arrayMatch = update.subfield.match(/^(\w+)\[(\d+)\](?:\.(\w+))?$/);
            if (arrayMatch) {
              const [, arrayName, index, prop] = arrayMatch;
              const idx = parseInt(index);
              
              // Ensure array exists
              if (!translationData.config[arrayName]) {
                translationData.config[arrayName] = [];
              }
              
              // Ensure array is large enough
              while (translationData.config[arrayName].length <= idx) {
                translationData.config[arrayName].push(prop ? {} : '');
              }
              
              if (prop) {
                // Array of objects: options[0].label
                if (typeof translationData.config[arrayName][idx] !== 'object') {
                  translationData.config[arrayName][idx] = {};
                }
                translationData.config[arrayName][idx][prop] = update.value;
              } else {
                // Array of strings: items[0]
                translationData.config[arrayName][idx] = update.value;
              }
            }
            // Handle nested objects: anchors.min
            else if (update.subfield.includes('.')) {
              const [parentKey, childKey] = update.subfield.split('.');
              if (!translationData.config[parentKey]) {
                translationData.config[parentKey] = {};
              }
              translationData.config[parentKey][childKey] = update.value;
            }
            // Simple config field: placeholder
            else {
              translationData.config[update.subfield] = update.value;
            }
          } else {
            // Top-level field: label or description
            translationData[update.field] = update.value;
          }

          console.log(`Updating ${update.questionId} [${update.locale}] ${update.field}${update.subfield ? '.' + update.subfield : ''} = "${update.value}"`);

          await updateQuestionTranslation(update.questionId, update.locale, translationData);
          successCount++;
        } catch (error) {
          console.error('Error updating translation:', error);
          errors.push(`${update.questionId}: ${error.message}`);
          errorCount++;
        }
      }

      // Reload questions to show updated translations
      await getAllQuestions(orgId, surveyId);

      const message = `Upload complete!\nSuccessfully updated: ${successCount}\nErrors: ${errorCount}`;
      if (errors.length > 0 && errors.length <= 5) {
        alert(message + '\n\nErrors:\n' + errors.join('\n'));
      } else {
        alert(message);
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      alert(`Failed to upload file: ${error.message}`);
    } finally {
      setUploadingFile(false);
      // Reset file input
      event.target.value = '';
    }
  };

  // ============================================
  // UPLOAD JSON
  // ============================================
  const handleJSONUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingFile(true);

    try {
      const text = await file.text();
      const translations = JSON.parse(text);

      let successCount = 0;
      let errorCount = 0;

      // Iterate through each question in the JSON
      for (const [questionId, questionData] of Object.entries(translations)) {
        const question = questions.find(q => q.questionId === questionId);
        if (!question) continue;

        // Get all locales (skip 'en' as it's the base language)
        const locales = new Set();
        if (questionData.label) {
          Object.keys(questionData.label).forEach(l => { if (l !== 'en') locales.add(l); });
        }
        if (questionData.description) {
          Object.keys(questionData.description).forEach(l => { if (l !== 'en') locales.add(l); });
        }
        if (questionData.config) {
          Object.values(questionData.config).forEach(configField => {
            if (typeof configField === 'object') {
              Object.keys(configField).forEach(l => { if (l !== 'en') locales.add(l); });
            }
          });
        }

        // Update each locale
        for (const locale of locales) {
          try {
            const existingTranslation = question.translations?.[locale] || {};

            // Deep clone config
            const mergedConfig = JSON.parse(JSON.stringify(question.config || {}));
            
            // Merge existing translation config
            if (existingTranslation.config) {
              Object.keys(existingTranslation.config).forEach(key => {
                mergedConfig[key] = existingTranslation.config[key];
              });
            }

            const translationData = {
              label: questionData.label?.[locale] || existingTranslation.label || question.label || '',
              description: questionData.description?.[locale] || existingTranslation.description || question.description || '',
              config: mergedConfig
            };

            // Merge config fields from JSON
            if (questionData.config) {
              Object.entries(questionData.config).forEach(([key, value]) => {
                if (typeof value === 'object' && value[locale]) {
                  // Handle nested structures properly
                  const arrayMatch = key.match(/^(\w+)\[(\d+)\](?:\.(\w+))?$/);
                  if (arrayMatch) {
                    const [, arrayName, index, prop] = arrayMatch;
                    const idx = parseInt(index);
                    
                    if (!translationData.config[arrayName]) {
                      translationData.config[arrayName] = [];
                    }
                    
                    while (translationData.config[arrayName].length <= idx) {
                      translationData.config[arrayName].push(prop ? {} : '');
                    }
                    
                    if (prop) {
                      if (typeof translationData.config[arrayName][idx] !== 'object') {
                        translationData.config[arrayName][idx] = {};
                      }
                      translationData.config[arrayName][idx][prop] = value[locale];
                    } else {
                      translationData.config[arrayName][idx] = value[locale];
                    }
                  } else if (key.includes('.')) {
                    const [parentKey, childKey] = key.split('.');
                    if (!translationData.config[parentKey]) {
                      translationData.config[parentKey] = {};
                    }
                    translationData.config[parentKey][childKey] = value[locale];
                  } else {
                    translationData.config[key] = value[locale];
                  }
                }
              });
            }

            await updateQuestionTranslation(questionId, locale, translationData);
            successCount++;
          } catch (error) {
            console.error('Error updating translation:', error);
            errorCount++;
          }
        }
      }

      await getAllQuestions(orgId, surveyId);
      alert(`Upload complete!\nSuccessfully updated: ${successCount}\nErrors: ${errorCount}`);
    } catch (error) {
      console.error('Error uploading JSON:', error);
      alert(`Failed to upload JSON: ${error.message}`);
    } finally {
      setUploadingFile(false);
      event.target.value = '';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-2" />
          <p className="text-gray-600">Loading questions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Language Selection Modal */}
      <LanguageSelectionModal
        isOpen={showLanguageModal}
        onClose={() => setShowLanguageModal(false)}
        availableLanguages={availableLanguages}
        onDownload={handleDownloadRequest}
      />

      {/* Header */}
      <div className="bg-white border-b">
        <div className=" mx-auto px-6 py-4">
          <div className="flex items-center justify-between mb-4">
           
            
            {/* Download/Upload buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowLanguageModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                disabled={questions.length === 0}
              >
                <Download className="w-4 h-4" />
                Download Translations
              </button>

              <div className="relative">
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="csv-upload"
                  disabled={uploadingFile}
                />
                <label
                  htmlFor="csv-upload"
                  className={`flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors cursor-pointer ${
                    uploadingFile ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  {uploadingFile ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4" />
                  )}
                  Upload CSV
                </label>
              </div>

              <div className="relative">
                <input
                  type="file"
                  accept=".json"
                  onChange={handleJSONUpload}
                  className="hidden"
                  id="json-upload"
                  disabled={uploadingFile}
                />
                <label
                  htmlFor="json-upload"
                  className={`flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors cursor-pointer ${
                    uploadingFile ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  {uploadingFile ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4" />
                  )}
                  Upload JSON
                </label>
              </div>
            </div>
          </div>
          
          {/* Search */}
          <div className="flex items-center gap-4 mb-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search resources..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          
          {/* Languages Info */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-gray-700">Active Languages:</span>
            {availableLanguages.map(lang => {
              const langInfo = AVAILABLE_LANGUAGES.find(l => l.code === lang) || { flag: '🏴', name: lang };
              return (
                <span key={lang} className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-sm">
                  {langInfo.flag} {langInfo.name}
                </span>
              );
            })}
          </div>
        </div>
      </div>
      
      {/* Table */}
      <div className=" mx-auto px-6 py-6">
        <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
          {questions.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No questions found. Please add questions to your survey first.
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50 z-10">
                    Resource
                  </th>
                  {availableLanguages.map(lang => {
                    const langInfo = AVAILABLE_LANGUAGES.find(l => l.code === lang) || { flag: '🏴', name: lang };
                    return (
                      <th key={lang} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[200px]">
                        {langInfo.flag} {langInfo.name}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
             {filteredRows.map((row) => {
                  const question = questions.find(q => q.questionId === row.questionId);
                  
                  return (
                    <tr key={row.resource} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900 font-mono sticky left-0 bg-white">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">{row.type}</span>
                          <span>{row.resource}</span>
                        </div>
                      </td>
                      {availableLanguages.map(locale => {
                        const cellKey = getCellKey(row.questionId, row.field, row.subfield, locale);
                        const rawValue = getTranslationValue(question, row.field, row.subfield, locale);
                        const displayValue = formatValueForDisplay(rawValue);
                        const editing = isEditing(row.questionId, row.field, row.subfield, locale);
                        const saving = isSaving(row.questionId, row.field, row.subfield, locale);
                        
                        return (
                          <td key={`${row.resource}-${locale}`} className="px-4 py-3 text-sm">
                            {editing ? (
                              <div className="flex items-center gap-2">
                                <input
                                  type="text"
                                  value={editValues[cellKey] || ''}
                                  onChange={(e) => setEditValues(prev => ({ ...prev, [cellKey]: e.target.value }))}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSave(row.questionId, row.field, row.subfield, locale);
                                    if (e.key === 'Escape') handleCancel(cellKey);
                                  }}
                                  className="flex-1 px-2 py-1 border border-blue-500 rounded focus:ring-2 focus:ring-blue-500 text-sm"
                                  autoFocus
                                  disabled={saving}
                                />
                                <button
                                  onClick={() => handleSave(row.questionId, row.field, row.subfield, locale)}
                                  disabled={saving}
                                  className="p-1 text-green-600 hover:bg-green-50 rounded disabled:opacity-50"
                                >
                                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                </button>
                                <button
                                  onClick={() => handleCancel(cellKey)}
                                  disabled={saving}
                                  className="p-1 text-red-600 hover:bg-red-50 rounded disabled:opacity-50"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            ) : (
                              <div
                                onClick={() => locale !== 'en' && handleCellClick(row.questionId, row.field, row.subfield, locale)}
                                className={`px-2 py-1 rounded ${
                                  locale === 'en' 
                                    ? 'bg-blue-50 text-gray-700 font-medium' 
                                    : 'cursor-pointer hover:bg-blue-50'
                                } ${!displayValue && locale !== 'en' ? 'text-gray-400 italic' : ''}`}
                              >
                                {displayValue || (locale === 'en' ? <span className="text-gray-400">empty</span> : 'Click to translate...')}
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        
        {/* Stats */}
        {questions.length > 0 && (
          <div className="mt-4 text-sm text-gray-600">
            <div>Showing {filteredRows.length} translatable fields across {availableLanguages.length} languages</div>
          </div>
        )}
      </div>
    </div>
  );
}