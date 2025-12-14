"use client";
import React, { useState, useEffect } from 'react';
import { Search, Languages, Save, X, Loader2, Plus } from 'lucide-react';
import { useQuestion } from '@/providers/questionPProvider';
import { AVAILABLE_LANGUAGES } from '@/utils/availableLanguages';
import { usePathname } from 'next/navigation';

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

  useEffect(() => {
    if (surveyId && orgId) {
      loadQuestions();
    }
  }, [surveyId, orgId]);

  const loadQuestions = async () => {
    setLoading(true);
    try {
      await getAllQuestions(orgId, surveyId);
    } finally {
      setLoading(false);
    }
  };

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

  const getTranslationValue = (question, field, subfield, locale) => {
    if (locale === 'en') {
      if (subfield) {
        return question[field]?.[subfield] || '';
      }
      return question[field] || '';
    }
    
    const translation = question.translations?.[locale];
    if (!translation) return '';
    
    if (subfield) {
      return translation?.[field]?.[subfield] || '';
    }
    return translation?.[field] || '';
  };

  const handleCellClick = (questionId, field, subfield, locale) => {
    if (locale === 'en') return; // Don't allow editing base language
    
    const question = questions.find(q => q.questionId === questionId);
    if (!question) return;
    
    const cellKey = `${questionId}-${field}-${subfield || 'none'}-${locale}`;
    const currentValue = getTranslationValue(question, field, subfield, locale);
    
    setEditingCells(prev => ({ ...prev, [cellKey]: true }));
    setEditValues(prev => ({ ...prev, [cellKey]: currentValue }));
  };

  const handleSave = async (questionId, field, subfield, locale) => {
    const cellKey = `${questionId}-${field}-${subfield || 'none'}-${locale}`;
    const editValue = editValues[cellKey] || '';

    setSavingCells(prev => new Set(prev).add(cellKey));
    
    try {
      const question = questions.find(q => q.questionId === questionId);
      if (!question) {
        throw new Error('Question not found');
      }

      // Get existing translation or create new
      const existingTranslation = question.translations?.[locale] || {};

      // Merge ALL config fields
      const mergedConfig = {};
      if (question.config) {
        Object.keys(question.config).forEach(key => {
          mergedConfig[key] = question.config[key];
        });
      }
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

      // Update the specific field
      if (subfield) {
        translationData.config[subfield] = editValue;
      } else {
        translationData[field] = editValue;
      }

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
      // Collect all config keys
      const allConfigKeys = new Set();
      if (question.config) {
        Object.keys(question.config).forEach(key => allConfigKeys.add(key));
      }
      if (question.translations) {
        Object.values(question.translations).forEach(translation => {
          if (translation.config) {
            Object.keys(translation.config).forEach(key => allConfigKeys.add(key));
          }
        });
      }

      // Label
      rows.push({
        questionId: question.questionId,
        field: 'label',
        subfield: null,
        resource: `${question.questionId},label`,
        type: question.type
      });

      // Description
      rows.push({
        questionId: question.questionId,
        field: 'description',
        subfield: null,
        resource: `${question.questionId},description`,
        type: question.type
      });

      // Config fields
      allConfigKeys.forEach(configKey => {
        rows.push({
          questionId: question.questionId,
          field: 'config',
          subfield: configKey,
          resource: `${question.questionId},config.${configKey}`,
          type: question.type
        });
      });
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
      {/* Header */}
      <div className="bg-white border-b">
        <div className=" mx-auto px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Languages className="w-6 h-6 text-blue-600" />
              <h1 className="text-2xl font-bold text-gray-900">Translation Manager - All Languages</h1>
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
                        const value = getTranslationValue(question, row.field, row.subfield, locale);
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
                                } ${!value && locale !== 'en' ? 'text-gray-400 italic' : ''}`}
                              >
                                {value || (locale === 'en' ? <span className="text-gray-400">empty</span> : 'Click to translate...')}
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