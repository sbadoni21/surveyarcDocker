import React from 'react';
import {
  Search,
  Plus,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import RuleList from './RuleList';
import RuleActionRow from './RuleActionRow';

const RuleBuilderComponent = ({
  viewMode,
  searchTerm,
  setSearchTerm,
  filterBy,
  setFilterBy,
  ruleBuilder,
  setRuleBuilder,
  processedQuestions,
  operatorsByType,
  updateCondition,
  addCondition,
  removeCondition,
  addAction,
  updateAction,
  removeAction,
  addRule,
  filteredRules,
  isCollapsed,
  setIsCollapsed,
  selectedRuleId,
  setSelectedRuleId,
  toggleRuleEnabled,
  duplicateRule,
  deleteRule,
  validationErrors,
  actionTypes,
}) => {
  return (
    <div className="p-6">
      {(viewMode === 'visual') && (
        <div className={`${viewMode === 'split' ? 'grid grid-cols-2 gap-6' : ''}`}>
                     {/* Visual Editor */}
                     <div className="space-y-6">
                       {/* Search and Filter */}
                       <div className="flex items-center space-x-4">
                         <div className="relative flex-1">
                           <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                           <input
                             type="text"
                             placeholder="Search rules..."
                             value={searchTerm}
                             onChange={(e) => setSearchTerm(e.target.value)}
                             className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                           />
                         </div>
                         <select
                           value={filterBy}
                           onChange={(e) => setFilterBy(e.target.value)}
                           className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                         >
                           <option value="all">All Rules</option>
                           <option value="enabled">Enabled</option>
                           <option value="disabled">Disabled</option>
                           <option value="errors">With Errors</option>
                         </select>
                       </div>
       
                       {/* Rule Builder */}
                       <div className="bg-slate-50 rounded-lg p-6 border border-slate-200">
                         <h3 className="text-lg font-semibold text-slate-900 mb-4">Rule Builder</h3>
                         
                         {/* Rule Metadata */}
                         <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                           <div>
                             <label className="block text-sm font-medium text-slate-700 mb-1">Rule Name</label>
                             <input
                               type="text"
                               value={ruleBuilder.name}
                               onChange={(e) => setRuleBuilder({...ruleBuilder, name: e.target.value})}
                               placeholder="Enter rule name..."
                               className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                             />
                           </div>
                           <div>
                             <label className="block text-sm font-medium text-slate-700 mb-1">Priority</label>
                             <input
                               type="number"
                               value={ruleBuilder.priority}
                               onChange={(e) => setRuleBuilder({...ruleBuilder, priority: parseInt(e.target.value) || 1})}
                               min="1"
                               max="100"
                               className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                             />
                           </div>
                           <div className="flex items-center">
                             <label className="flex items-center space-x-2">
                               <input
                                 type="checkbox"
                                 checked={ruleBuilder.enabled}
                                 onChange={(e) => setRuleBuilder({...ruleBuilder, enabled: e.target.checked})}
                                 className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                               />
                               <span className="text-sm font-medium text-slate-700">Enabled</span>
                             </label>
                           </div>
                         </div>
       
                         {/* Conditions */}
                         <div className="mb-6">
                           <div className="flex items-center justify-between mb-3">
                             <h4 className="text-md font-medium text-slate-800">Conditions</h4>
                             <div className="flex items-center space-x-2">
                               <select
                                 value={ruleBuilder.conditionLogic}
                                 onChange={(e) => setRuleBuilder({...ruleBuilder, conditionLogic: e.target.value})}
                                 className="px-3 py-1 text-sm border border-slate-300 rounded-md"
                               >
                                 <option value="AND">AND</option>
                                 <option value="OR">OR</option>
                               </select>
                               <button
                                 onClick={addCondition}
                                 className="flex items-center px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
                               >
                                 <Plus className="h-4 w-4 mr-1" />
                                 Add
                               </button>
                             </div>
                           </div>
       
                           <div className="space-y-3">
                             {ruleBuilder.conditions.map((condition, index) => (
                               <div key={condition.id} className="flex items-center space-x-3 p-3 bg-white rounded-lg border border-slate-200">
                                 {index > 0 && (
                                   <div className="text-sm font-medium text-slate-600 px-2">
                                     {ruleBuilder.conditionLogic}
                                   </div>
                                 )}
                                 
                                 <select
                                   value={condition.questionId}
                                   onChange={(e) => updateCondition(condition.id, 'questionId', e.target.value)}
                                   className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-md"
                                 >
                                   <option value="">Select Question</option>
                                   {processedQuestions.map(q => (
                                     <option key={q.id} value={q.id}>{q.title}</option>
                                   ))}
                                 </select>
       
                                 <select
                                   value={condition.dataType}
                                   onChange={(e) => updateCondition(condition.id, 'dataType', e.target.value)}
                                   className="px-3 py-2 text-sm border border-slate-300 rounded-md"
                                 >
                                   <option value="string">Text</option>
                                   <option value="number">Number</option>
                                   <option value="boolean">Boolean</option>
                                   <option value="date">Date</option>
                                   <option value="array">Array</option>
                                 </select>
       
                                 <select
                                   value={condition.operator}
                                   onChange={(e) => updateCondition(condition.id, 'operator', e.target.value)}
                                   className="px-3 py-2 text-sm border border-slate-300 rounded-md"
                                 >
                                   {operatorsByType[condition.dataType]?.map(op => (
                                     <option key={op} value={op}>
                                       {op.replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2')}
                                     </option>
                                   ))}
                                 </select>
       
                                 <input
                                   type={condition.dataType === 'number' ? 'number' : 'text'}
                                   value={condition.value}
                                   onChange={(e) => updateCondition(condition.id, 'value', e.target.value)}
                                   placeholder="Value..."
                                   className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-md"
                                 />
       
                                 {ruleBuilder.conditions.length > 1 && (
                                   <button
                                     onClick={() => removeCondition(condition.id)}
                                     className="p-2 text-red-600 hover:bg-red-50 rounded-md"
                                   >
                                     <Trash2 className="h-4 w-4" />
                                   </button>
                                 )}
                               </div>
                             ))}
                           </div>
                         </div>
       
                         {/* Actions */}
                         <div className="mb-6">
                           <div className="flex items-center justify-between mb-3">
                             <h4 className="text-md font-medium text-slate-800">Actions</h4>
                             <button
                               onClick={addAction}
                               className="flex items-center px-3 py-1 text-sm bg-green-600 text-white rounded-md hover:bg-green-700"
                             >
                               <Plus className="h-4 w-4 mr-1" />
                               Add Action
                             </button>
                           </div>
       
                           <div className="space-y-3">
                           
{ruleBuilder.actions.map((action) => (
  <RuleActionRow
    key={action.id}
    action={action}
    updateAction={updateAction}
    removeAction={removeAction}
    processedQuestions={processedQuestions}
    actionTypes={actionTypes}
    showRemove={ruleBuilder.actions.length > 1}
  />
))}
                           </div>
                         </div>
       
                         {/* Add Rule Button */}
                         <button
                           onClick={addRule}
                           disabled={!ruleBuilder.name.trim() || ruleBuilder.conditions.some(c => !c.questionId)}
                           className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                         >
                           <Plus className="h-5 w-5 inline mr-2" />
                           Add Rule to Logic
                         </button>
                       </div>
       
                       {/* Existing Rules */}
                       <div className="space-y-4">
                         <div className="flex items-center justify-between">
                           <h3 className="text-lg font-semibold text-slate-900">
                             Existing Rules ({filteredRules.length})
                           </h3>
                           <button
                             onClick={() => setIsCollapsed(!isCollapsed)}
                             className="flex items-center text-sm text-slate-600 hover:text-slate-900"
                           >
                             {isCollapsed ? <ChevronRight className="h-4 w-4 mr-1" /> : <ChevronDown className="h-4 w-4 mr-1" />}
                             {isCollapsed ? 'Expand' : 'Collapse'}
                           </button>
                         </div>
       
                         {!isCollapsed && (
                       <RuleList
  filteredRules={filteredRules}
  selectedRuleId={selectedRuleId}
  setSelectedRuleId={setSelectedRuleId}
  toggleRuleEnabled={toggleRuleEnabled}
  duplicateRule={duplicateRule}
  deleteRule={deleteRule}
  validationErrors={validationErrors}
/>
                         )}
                       </div>
                     </div>
       
               
                   </div>
      )}
    </div>
  );
};

export default RuleBuilderComponent;
