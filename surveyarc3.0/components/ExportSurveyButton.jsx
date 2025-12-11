// components/ExportSurveyButton.jsx
'use client';

import React, { useState } from 'react';
import { exportSurveyToExcel } from '@/utils/exportToExcel';
import { exportSurveyToSPSS } from '@/utils/exportToSPSS';

const ExportSurveyButton = ({ surveyName, responses, questions }) => {
  const [exporting, setExporting] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const handleExport = async (format = 'excel') => {
    // Validate data
    if (!responses || responses.length === 0) {
      alert('No responses to export');
      return;
    }

    if (!questions || questions.length === 0) {
      alert('No questions found');
      return;
    }

    setExporting(true);
    setShowMenu(false);

    try {
      // Transform responses to match expected format
      const transformedResponses = responses.map(response => {
        const answers = response.answers || response.answersBlob || response.answers_blob || [];
        
        return {
          response_id: response.responseId || response.response_id,
          respondent_id: response.respondentId || response.respondent_id,
          status: response.status,
          started_at: response.startedAt || response.started_at,
          completed_at: response.completedAt || response.completed_at,
          answers: answers
        };
      });

      // Transform questions to match expected format
      const transformedQuestions = questions.map(question => ({
        question_id: question.questionId || question.question_id,
        label: question.label,
        type: question.type,
        description: question.description || '',
        required: question.required,
        config: question.config || {}
      }));

      let result;
      
      if (format === 'spss') {
        result = await exportSurveyToSPSS(
          transformedResponses,
          transformedQuestions,
          surveyName || 'Survey'
        );
        
        if (result.success) {
          const csvName = result.csvFileName || 'data.csv';
          const spsName = result.spsFileName || 'syntax.sps';
          console.log(`✅ Exported SPSS: ${csvName} and ${spsName}`);
          alert(`Successfully exported SPSS files:\n- ${csvName}\n- ${spsName}\n\nOpen the .sps file in SPSS to import the data.`);
        } else {
          alert(`SPSS export failed: ${result.error || 'Unknown error'}`);
        }
      } else {
        result = await exportSurveyToExcel(
          transformedResponses,
          transformedQuestions,
          surveyName || 'Survey'
        );
        
        if (result.success) {
          const fileName = result.fileName || 'survey_export.xlsx';
          console.log(`✅ Exported Excel: ${fileName}`);
          alert(`Successfully exported ${fileName}`);
        } else {
          alert(`Excel export failed: ${result.error || 'Unknown error'}`);
        }
      }
    } catch (error) {
      console.error('Export error:', error);
      alert('Failed to export data: ' + error.message);
    } finally {
      setExporting(false);
    }
  };

  const responseCount = responses?.length || 0;

  return (
    <div className="relative inline-block">
      {/* Main Export Button */}
      <button
        onClick={() => setShowMenu(!showMenu)}
        disabled={exporting || responseCount === 0}
        className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 
                   disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors
                   flex items-center gap-2 font-medium shadow-sm"
        title={responseCount === 0 ? 'No responses to export' : `Export ${responseCount} responses`}
      >
        {exporting ? (
          <>
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
              <circle 
                className="opacity-25" 
                cx="12" 
                cy="12" 
                r="10" 
                stroke="currentColor" 
                strokeWidth="4" 
                fill="none"
              />
              <path 
                className="opacity-75" 
                fill="currentColor" 
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Exporting...
          </>
        ) : (
          <>
            <svg 
              className="h-5 w-5" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" 
              />
            </svg>
            Export Data
            {responseCount > 0 && (
              <span className="text-xs bg-green-800 px-2 py-0.5 rounded-full">
                {responseCount}
              </span>
            )}
            <svg 
              className={`h-4 w-4 transition-transform ${showMenu ? 'rotate-180' : ''}`}
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </>
        )}
      </button>

      {/* Dropdown Menu */}
      {showMenu && !exporting && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setShowMenu(false)}
          />
          
          {/* Menu */}
          <div className="absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-20">
            <div className="py-1">
              <button
                onClick={() => handleExport('excel')}
                className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-100 
                           flex items-center gap-3 transition-colors"
              >
                <svg className="h-5 w-5 text-green-600" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z"/>
                  <path d="M14 2v6h6M9 13h6M9 17h6M9 9h2"/>
                </svg>
                <div>
                  <div className="font-medium">Excel (.xlsx)</div>
                  <div className="text-xs text-gray-500">Multiple sheets with analysis</div>
                </div>
              </button>

              <button
                onClick={() => handleExport('spss')}
                className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-100 
                           flex items-center gap-3 transition-colors border-t border-gray-100"
              >
                <svg className="h-5 w-5 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z"/>
                  <path d="M14 2v6h6M10 12h4M10 16h4"/>
                </svg>
                <div>
                  <div className="font-medium">SPSS (.sps + .csv)</div>
                  <div className="text-xs text-gray-500">For statistical analysis</div>
                </div>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ExportSurveyButton;