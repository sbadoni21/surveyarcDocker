import React, { useState } from 'react';
import { X, CheckCircle, Users, ShoppingCart, TrendingUp, Star, Heart, Lightbulb, Target, BarChart } from 'lucide-react';
import { SURVEY_TEMPLATES } from '@/utils/surveyTemplates';
import { IconButton } from '@mui/material';
import { createSurveyFromTemplate } from '@/utils/createSurveyFromTemplate';




// Template Selection Popup Component
export const TemplateSelectionPopup = ({ isOpen, onClose, onSelectTemplate, orgId, projectId }) => {
  const [selectedTemplate, setSelectedTemplate] = useState(null);

  if (!isOpen) return null;

  const handleSelect = (templateKey) => {
    const template = SURVEY_TEMPLATES[templateKey];
    setSelectedTemplate(template);
  };

  const handleCreate = async () => {
    if (!selectedTemplate) return;
    
    try {
      await onSelectTemplate(selectedTemplate);
      onClose();
    } catch (error) {
      console.error('Error creating survey from template:', error);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Choose a Survey Template</h2>
            <p className="text-gray-600 mt-1">Start with a pre-built template or create from scratch</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Template Grid */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(SURVEY_TEMPLATES).map(([key, template]) => {
              const isSelected = selectedTemplate?.id === template.id;

              return (
                <button
                  key={key}
                  onClick={() => handleSelect(key)}
                  className={`relative p-6 rounded-lg border-2 transition-all text-left hover:shadow-lg ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {isSelected && (
                    <div className="absolute top-3 right-3">
                      <CheckCircle className="text-blue-500" size={20} />
                    </div>
                  )}
                  
                  {/* Icon Container - Fixed */}
                  <div className={`${template.color || 'bg-blue-500'} w-12 h-12 rounded-lg flex items-center justify-center mb-4`}>
                    <span className="text-white text-2xl">
                      {template.icon || '📋'}
                    </span>
                  </div>
                  
                  <h3 className="font-semibold text-gray-800 mb-2">{template.name}</h3>
                  <p className="text-sm text-gray-600">{template.description}</p>
                  
                  <div className="mt-4 text-xs text-gray-500">
                    {template.questions.length} questions
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:text-gray-900 transition-colors"
          >
            Cancel
          </button>
          
          <div className="flex gap-3">
            <button
              onClick={() => onSelectTemplate(null)}
              className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
            >
              Start Blank
            </button>
            
            <button
              onClick={handleCreate}
              disabled={!selectedTemplate}
              className={`px-6 py-2 rounded-lg transition-colors ${
                selectedTemplate
                  ? 'bg-blue-500 text-white hover:bg-blue-600'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              Use Template
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
