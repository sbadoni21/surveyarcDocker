'use client';
import React, { useEffect, useRef, useState } from 'react';
import { auth } from '@/firebase/firebase.js';
import { useOrganisation } from '@/providers/organisationPProvider';

export default function OrgChatFlow({ onNext, onBack }) {
  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState({
    orgName: '',
    industry: '',
    size: '',
    region: '',
    country: '',
    timezone: '',
  });
  const [isVisible, setIsVisible] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { create } = useOrganisation();
  const inputRef = useRef(null);
  const questions = [
    {
      key: 'orgName',
      title: 'Organization Name',
      template: 'Hello! My organization name is ___________',
      placeholder: 'Enter your organization name',
      icon: '🏢',
      required: true,
    },
    {
      key: 'industry',
      title: 'Industry',
      template: `${formData.orgName || 'My organization'} operates in the ___________ industry`,
      placeholder: 'e.g. Education, Healthcare, Technology',
      icon: '🏭',
      required: false,
    },
    {
      key: 'size',
      title: 'Team Size',
      template: `We have ___________ people in our team`,
      placeholder: 'Enter number of team members',
      icon: '👥',
      required: false,
    },
  ];

  // Fetch location data on component mount
  useEffect(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

    const fetchLocation = async () => {
      try {
        // const res = await fetch('https://ipapi.co/json/');
        // const data = await res.json();

        setFormData((prev) => ({
          ...prev,
          region:  'hi',
          country:  'ind',
          timezone: tz,
        }));
      } catch (err) {
        console.warn('Failed to fetch IP location:', err);
        setFormData((prev) => ({ ...prev, timezone: tz }));
      }
    };

    fetchLocation();
  }, []);

  // useEffect(() => {
  //   if (isVisible && inputRef.current) {
  //     setTimeout(() => {
  //       inputRef.current.focus();
  //     }, 300);
  //   }
  // }, [isVisible, step]);

  const handleInput = (e) => {
    const value = e.target.value;
    const currentKey = questions[step].key;
    setFormData((prev) => ({ ...prev, [currentKey]: value }));
    setError(''); // Clear error when user starts typing
  };

  const handleNext = async () => {
    const currentQuestion = questions[step];
    const currentValue = formData[currentQuestion.key];
    
    if (currentQuestion.required && !currentValue?.trim()) {
      setError('This field is required');
      return;
    }

    setError('');
    setIsVisible(false);
    
    await new Promise(resolve => setTimeout(resolve, 300));

    if (step < questions.length - 1) {
      setStep(prev => prev + 1);
      setIsVisible(true);
    } else {
      await handleSubmit();
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError('');

    const user = auth.currentUser;
    if (!user) {
      setError('You must be logged in to create an organization.');
      setLoading(false);
      return;
    }

    try {
      const orgId = user.uid;

      const orgdata = {
        uid: orgId,
        orgName: formData.orgName,
        ownerUID: user.uid,
        industry: formData.industry,
        size: formData.size,
        region: formData.region,
        country: formData.country,
        timezone: formData.timezone,
        ownerEmail: user.email,
        createdVia: 'web',
      };

      console.log(orgdata);
      const res = await create(orgdata);
      console.log(res)
      onNext(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleNext();
    }
  };

  const handleBack = async () => {
    if (step > 0) {
      setIsVisible(false);
      setTimeout(() => {
        setStep(prev => prev - 1);
        setIsVisible(true);
        setError('');
      }, 300);
    } else {
      onBack?.();
    }
  };

  const currentQuestion = questions[step];
  const currentValue = formData[currentQuestion.key];

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-purple-50 to-pink-100 flex items-center justify-center p-4">
      {/* Background Overlay */}
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" />
      
      {/* Popup Card */}
      <div 
        className={`relative bg-white rounded-3xl shadow-2xl p-8 w-full max-w-2xl transform transition-all duration-500 ${
          isVisible 
            ? 'scale-100 opacity-100 translate-y-0' 
            : 'scale-95 opacity-0 translate-y-4'
        }`}
      >
        {/* Progress Indicator */}
        <div className="flex justify-center mb-8">
          <div className="flex space-x-2">
            {questions.map((_, i) => (
              <div
                key={i}
                className={`w-3 h-3 rounded-full transition-all duration-500 ${
                  i < step ? 'bg-green-500' : 
                  i === step ? 'bg-blue-500' : 'bg-gray-300'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Question Header */}
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">{currentQuestion.icon}</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            {currentQuestion.title}
            {currentQuestion.required && <span className="text-red-500 ml-1">*</span>}
          </h2>
          <p className="text-gray-600">
            Step {step + 1} of {questions.length}
          </p>
        </div>

        {/* Fill in the Blank */}
        <div className="mb-8">
          <div className="bg-gray-50 rounded-2xl p-6 text-center">
            <p className="text-lg text-gray-700 leading-relaxed">
              {currentQuestion.template.split('___________').map((part, index) => (
                <span key={index}>
                  {part}
                  {index < currentQuestion.template.split('___________').length - 1 && (
                    <span className="relative inline-block min-w-[120px]">
                      <input
                        ref={inputRef}
                        type={currentQuestion.key === 'size' ? 'number' : 'text'}
                        placeholder={currentQuestion.placeholder}
                        value={currentValue}
                        onChange={handleInput}
                        onKeyDown={handleKeyDown}
                        className="inline-block bg-transparent border-none outline-none border-b-2 border-blue-300 focus:border-blue-500 text-blue-600 font-semibold text-lg px-2 py-1 text-center min-w-[120px] placeholder-blue-300 placeholder-opacity-60"
                        style={{ 
                          width: Math.max(120, (currentValue?.length || 0) * 12 + 40) + 'px'
                        }}
                      />
                    </span>
                  )}
                </span>
              ))}
            </p>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-600 text-sm text-center">{error}</p>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center justify-center space-x-2">
              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-blue-600 text-sm">Creating your organization...</p>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-between items-center">
          <button
            onClick={handleBack}
            disabled={loading}
            className={`px-6 py-3 rounded-xl font-medium transition-all duration-200 ${
              loading
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            ← Back
          </button>

          <div className="text-sm text-gray-500">
            Press Enter to continue
          </div>

          <button
            onClick={handleNext}
            disabled={loading || (currentQuestion.required && !currentValue?.trim())}
            className={`px-8 py-3 rounded-xl font-medium transition-all duration-200 ${
              loading || (currentQuestion.required && !currentValue?.trim())
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-blue-500 to-purple-500 text-white hover:shadow-lg transform hover:scale-105'
            }`}
          >
            {loading ? (
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Please wait...</span>
              </div>
            ) : (
              step === questions.length - 1 ? 'Create Organization' : 'Next →'
            )}
          </button>
        </div>

        {/* Completion Preview */}
        {step > 0 && (
          <div className="mt-8 pt-6 border-t border-gray-200">
            <h3 className="text-sm font-medium text-gray-600 mb-3">Your Progress:</h3>
            <div className="space-y-2">
              {questions.slice(0, step).map((q, i) => (
                <div key={i} className="flex items-center space-x-2 text-sm">
                  <span className="w-2 h-2 bg-green-500 rounded-full" />
                  <span className="text-gray-700">
                    {q.title}: <span className="font-medium text-gray-900">{formData[q.key] || 'Not specified'}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Floating Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-20 h-20 bg-blue-300/20 rounded-full animate-pulse" />
        <div className="absolute top-40 right-20 w-16 h-16 bg-purple-300/20 rounded-full animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute bottom-32 left-1/4 w-12 h-12 bg-pink-300/20 rounded-full animate-pulse" style={{ animationDelay: '2s' }} />
        <div className="absolute bottom-20 right-1/3 w-24 h-24 bg-indigo-300/20 rounded-full animate-pulse" style={{ animationDelay: '0.5s' }} />
      </div>
    </div>
  );
}