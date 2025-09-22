import React, { useState, useMemo } from 'react';
import { X, Search, Filter, Eye, Plus, MessageCircle, ExternalLink, Phone } from 'lucide-react';
import { 
  DEFAULT_TEMPLATES, 
  TEMPLATE_CATEGORIES, 
  INDUSTRY_FILTERS, 
  USE_CASE_FILTERS,
  filterTemplates 
} from '../../utils/defaultTemplates.js';
import { slugifyWabaName } from '@/utils/waba.js';

export default function TemplateLibrary({ isOpen, onClose, onSelectTemplate }) {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedIndustry, setSelectedIndustry] = useState('all');
  const [selectedUseCase, setSelectedUseCase] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [previewTemplate, setPreviewTemplate] = useState(null);
const [showTemplateLibrary, setShowTemplateLibrary] = useState(false);

  const filteredTemplates = useMemo(() => {
    return filterTemplates(selectedCategory, selectedIndustry, selectedUseCase, searchTerm);
  }, [selectedCategory, selectedIndustry, selectedUseCase, searchTerm]);

  const handleSelectTemplate = (template) => {
    // Create a customizable copy of the template
   const customizableTemplate = {
     ...template,
     name: slugifyWabaName(`${template.id || template.name}_copy`),
     status: "draft",
     components: { ...template.components },
   };
    onSelectTemplate(customizableTemplate);
    onClose();
  };

  const renderTemplatePreview = (template) => {
    const { header, body, footer, buttons } = template.components;
    
    // Replace variables with sample data for preview
    const replaceVarsForPreview = (text, variables) => {
      let result = text || '';
      variables.forEach((variable, index) => {
        const placeholder = `{{${index + 1}}}`;
        const sampleValue = variable || `Sample ${index + 1}`;
        result = result.replace(new RegExp(`\\{\\{${index + 1}\\}\\}`, 'g'), sampleValue);
      });
      return result;
    };

    return (
      <div className="bg-gradient-to-b from-green-100 to-green-50 p-4 rounded-lg">
        <div className="flex items-center gap-2 mb-4 text-sm text-gray-600">
          <MessageCircle size={16} />
          <span>WhatsApp Business</span>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm max-w-sm mx-auto">
          {/* Header */}
          {header.type !== "NONE" && (
            <div className="border-b p-3">
              {header.type === "TEXT" && (
                <div className="font-medium text-gray-800">
                  {replaceVarsForPreview(header.text, template.variables)}
                </div>
              )}
              {header.type === "IMAGE" && (
                <div className="flex items-center gap-2 text-gray-600">
                  <img src="/api/placeholder/100/60" alt="Header" className="w-full h-16 object-cover rounded" />
                </div>
              )}
            </div>
          )}

          {/* Body */}
          <div className="p-3">
            <div className="whitespace-pre-wrap text-gray-800">
              {replaceVarsForPreview(body.text, template.variables)}
            </div>
          </div>

          {/* Footer */}
          {footer.text && (
            <div className="px-3 pb-3">
              <div className="text-xs text-gray-500 italic">
                {replaceVarsForPreview(footer.text, template.variables)}
              </div>
            </div>
          )}

          {/* Buttons */}
          {buttons.length > 0 && (
            <div className="border-t p-2 space-y-1">
              {buttons.slice(0, 3).map((btn, index) => (
                <div key={index} className="w-full">
                  {btn.type === "QUICK_REPLY" && (
                    <button className="w-full py-2 px-3 text-sm text-blue-600 border border-blue-200 rounded hover:bg-blue-50">
                      {btn.text}
                    </button>
                  )}
                  {btn.type === "URL" && (
                    <button className="w-full py-2 px-3 text-sm text-blue-600 border border-blue-200 rounded hover:bg-blue-50 flex items-center justify-center gap-1">
                      <ExternalLink size={12} />
                      {btn.text}
                    </button>
                  )}
                  {btn.type === "PHONE_NUMBER" && (
                    <button className="w-full py-2 px-3 text-sm text-green-600 border border-green-200 rounded hover:bg-green-50 flex items-center justify-center gap-1">
                      <Phone size={12} />
                      {btn.text}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Template Variables */}
        <div className="mt-4 p-3 bg-blue-50 rounded text-xs">
          <div className="font-medium text-blue-800 mb-2">Required Variables:</div>
          <div className="space-y-1">
            {template.variables.map((variable, index) => (
              <div key={index} className="flex items-center gap-2">
                <span className="text-blue-600 font-mono">{`{{${index + 1}}}`}</span>
                <span className="text-blue-700">{variable}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-7xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900">Template Library</h2>
            <p className="text-gray-600">Choose from professionally designed templates for your business</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X size={20} />
          </button>
        </div>

        <div className="flex h-[calc(90vh-120px)]">
          {/* Filters Sidebar */}
          <div className="w-80 border-r bg-gray-50 p-6 overflow-y-auto">
            <div className="space-y-6">
              {/* Search */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Search Templates</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search by name or content..."
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Category Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                <div className="space-y-2">
                  {TEMPLATE_CATEGORIES.map(category => (
                    <button
                      key={category.id}
                      onClick={() => setSelectedCategory(category.id)}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors ${
                        selectedCategory === category.id 
                          ? 'bg-green-100 text-green-700 border border-green-200' 
                          : 'hover:bg-gray-100 text-gray-700'
                      }`}
                    >
                      <span>{category.icon}</span>
                      <span className="text-sm">{category.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Industry Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Industry</label>
                <select
                  value={selectedIndustry}
                  onChange={(e) => setSelectedIndustry(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
                >
                  {INDUSTRY_FILTERS.map(industry => (
                    <option key={industry.id} value={industry.id}>
                      {industry.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Use Case Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Use Case</label>
                <select
                  value={selectedUseCase}
                  onChange={(e) => setSelectedUseCase(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
                >
                  {USE_CASE_FILTERS.map(useCase => (
                    <option key={useCase.id} value={useCase.id}>
                      {useCase.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Results Count */}
              <div className="pt-4 border-t">
                <p className="text-sm text-gray-600">
                  {filteredTemplates.length} template{filteredTemplates.length !== 1 ? 's' : ''} found
                </p>
              </div>
            </div>
          </div>

          {/* Templates Grid */}
          <div className="flex-1 overflow-y-auto">
            {previewTemplate ? (
              /* Preview Mode */
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900">{previewTemplate.name}</h3>
                    <p className="text-gray-600">{previewTemplate.description}</p>
                    <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                      <span className="bg-gray-100 px-2 py-1 rounded">{previewTemplate.category}</span>
                      <span>{previewTemplate.industry}</span>
                      <span>{previewTemplate.useCase}</span>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setPreviewTemplate(null)}
                      className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      Back to Library
                    </button>
                    <button
                      onClick={() => handleSelectTemplate(previewTemplate)}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
                    >
                      <Plus size={16} />
                      Use This Template
                    </button>
                  </div>
                </div>

                <div className="grid lg:grid-cols-2 gap-8">
                  <div>
                    {renderTemplatePreview(previewTemplate)}
                  </div>
                  <div className="space-y-6">
                    <div>
                      <h4 className="font-medium text-gray-900 mb-3">Template Details</h4>
                      <div className="space-y-2 text-sm">
                        <div><span className="font-medium">Category:</span> {previewTemplate.category}</div>
                        <div><span className="font-medium">Industry:</span> {previewTemplate.industry}</div>
                        <div><span className="font-medium">Use Case:</span> {previewTemplate.useCase}</div>
                        <div><span className="font-medium">Language:</span> {previewTemplate.language}</div>
                        <div><span className="font-medium">Variables:</span> {previewTemplate.variables.length}</div>
                        <div><span className="font-medium">Buttons:</span> {previewTemplate.components.buttons.length}</div>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-medium text-gray-900 mb-3">How to Use</h4>
                      <div className="text-sm text-gray-600 space-y-2">
                        <p>1. Click "Use This Template" to add it to your templates</p>
                        <p>2. Customize the content and variables for your business</p>
                        <p>3. Submit for WhatsApp approval</p>
                        <p>4. Start sending personalized messages to your customers</p>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-medium text-gray-900 mb-3">Variable Customization</h4>
                      <div className="text-sm text-gray-600">
                        <p>This template requires {previewTemplate.variables.length} variables that you can customize:</p>
                        <ul className="mt-2 space-y-1">
                          {previewTemplate.variables.map((variable, index) => (
                            <li key={index} className="flex items-center gap-2">
                              <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">{`{${index + 1}}`}</code>
                              <span>{variable}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* Templates Grid */
              <div className="p-6">
                {filteredTemplates.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Search className="text-gray-400" size={32} />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">No templates found</h3>
                    <p className="text-gray-600">Try adjusting your search or filter criteria.</p>
                  </div>
                ) : (
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredTemplates.map((template) => (
                      <div key={template.id} className="bg-white border border-gray-200 rounded-xl hover:shadow-md transition-shadow">
                        <div className="p-6">
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center gap-3">
                              <div className="text-2xl">
                                {TEMPLATE_CATEGORIES.find(c => c.id === template.category)?.icon || '📝'}
                              </div>
                              <div>
                                <h3 className="font-semibold text-gray-900 text-sm">{template.name}</h3>
                                <p className="text-xs text-gray-500">{template.industry} • {template.category}</p>
                              </div>
                            </div>
                          </div>

                          <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                            {template.description}
                          </p>

                          <div className="flex items-center justify-between">
                            <div className="text-xs text-gray-500">
                              {template.variables.length} variables • {template.components.buttons.length} buttons
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => setPreviewTemplate(template)}
                                className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                title="Preview template"
                              >
                                <Eye size={16} />
                              </button>
                              <button
                                onClick={() => handleSelectTemplate(template)}
                                className="p-2 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                title="Use template"
                              >
                                <Plus size={16} />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}