"use client";
import React, { useState, useEffect, useRef } from "react";
import { X, Loader2, CheckCircle2, AlertCircle, StopCircle, Clock } from "lucide-react";

export default function DummyGeneratorPanel({ orgId, projectId, surveyId }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [count, setCount] = useState(10);
  const [completed, setCompleted] = useState(0);
  const [status, setStatus] = useState("idle"); // idle, generating, success, error, stopped
  const [error, setError] = useState(null);
  const [startTime, setStartTime] = useState(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [jobId, setJobId] = useState(null);
  const pollIntervalRef = useRef(null);
  const timerIntervalRef = useRef(null);

  // Format time in MM:SS
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Calculate estimated time remaining
  const getEstimatedTime = () => {
    if (completed === 0 || elapsedTime === 0) return "Calculating...";
    const rate = completed / elapsedTime; // responses per second
    const remaining = count - completed;
    const estimatedSeconds = Math.ceil(remaining / rate);
    return formatTime(estimatedSeconds);
  };

  // Timer for elapsed time
  useEffect(() => {
    if (isGenerating && startTime) {
      timerIntervalRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        setElapsedTime(elapsed);
      }, 1000);
    } else {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    }

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [isGenerating, startTime]);

  // Poll for progress
  useEffect(() => {
    if (!isGenerating || !jobId) return;

    const pollProgress = async () => {
      try {
        const res = await fetch(
          `/en/api/post-gres-apis/surveys/${surveyId}/generate-status/${jobId}`
        );
        
        if (res.ok) {
          const data = await res.json();
          setCompleted(data.completed || 0);
          
          if (data.status === "completed") {
            setIsGenerating(false);
            setStatus("success");
            setCompleted(count);
            if (pollIntervalRef.current) {
              clearInterval(pollIntervalRef.current);
            }
          } else if (data.status === "failed" || data.status === "stopped") {
            setIsGenerating(false);
            setStatus(data.status === "stopped" ? "stopped" : "error");
            setError(data.error || "Generation failed");
            if (pollIntervalRef.current) {
              clearInterval(pollIntervalRef.current);
            }
          }
        }
      } catch (err) {
        console.error("Failed to fetch progress:", err);
      }
    };

    // Poll every 2 seconds
    pollIntervalRef.current = setInterval(pollProgress, 2000);
    pollProgress(); // Initial call

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [isGenerating, jobId, surveyId, count]);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setStatus("generating");
    setError(null);
    setCompleted(0);
    setStartTime(Date.now());
    setElapsedTime(0);

    try {
      const res = await fetch(
        `/en/api/post-gres-apis/surveys/${surveyId}/generate-dummy`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orgId,
            projectId,
            count,
            concurrency: 5,
            headless: true,
          }),
        }
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Failed to start dummy generation");
      }

      const data = await res.json();
      console.log("Generation started:", data);
      
      // Backend returns task_id - use it for tracking
      const backendJobId = data.task_id || data.taskId || data.jobId || data.job_id || data.id;
      
      if (backendJobId) {
        console.log("Using backend task tracking:", backendJobId);
        setJobId(backendJobId);
      } else {
        // Fallback: simulate if no job tracking available yet
        console.log("No job ID provided, using simulated progress");
        setJobId("simulated-" + Date.now());
        simulateProgress();
      }
      
    } catch (err) {
      setIsGenerating(false);
      setStatus("error");
      setError(err.message || "Failed to start generation");
      setCompleted(0);
    }
  };

  // Fallback simulation if backend doesn't provide real-time progress
  const simulateProgress = () => {
    const duration = count * 200; // ~200ms per response
    const updateInterval = 500;
    const incrementPerUpdate = (count / (duration / updateInterval));
    
    const interval = setInterval(() => {
      setCompleted((prev) => {
        const next = Math.min(prev + incrementPerUpdate, count);
        if (next >= count) {
          clearInterval(interval);
          setIsGenerating(false);
          setStatus("success");
          return count;
        }
        return next;
      });
    }, updateInterval);
  };

  const handleStop = async () => {
    if (!confirm("Are you sure you want to stop the generation?")) return;

    try {
      const res = await fetch(
        `/en/api/post-gres-apis/surveys/${surveyId}/generate-stop/${jobId}`,
        { method: "POST" }
      );

      if (res.ok) {
        setIsGenerating(false);
        setStatus("stopped");
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
        }
      }
    } catch (err) {
      console.error("Failed to stop generation:", err);
      // Force stop locally anyway
      setIsGenerating(false);
      setStatus("stopped");
    }
  };

  const handleClose = () => {
    if (isGenerating) {
      if (!confirm("Generation is in progress. Are you sure you want to close?")) {
        return;
      }
    }
    setIsOpen(false);
    if (!isGenerating) {
      setStatus("idle");
      setError(null);
      setCompleted(0);
      setElapsedTime(0);
    }
  };

  const handleReset = () => {
    setStatus("idle");
    setError(null);
    setCompleted(0);
    setIsGenerating(false);
    setStartTime(null);
    setElapsedTime(0);
    setJobId(null);
  };

  const progress = count > 0 ? Math.round((completed / count) * 100) : 0;

  return (
    <>
      {/* Trigger Button - always visible if not generating */}
      {!isOpen && !isGenerating && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-28 right-6 px-4 py-3 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-medium shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200 flex items-center gap-2 z-50"
        >
          <span className="text-lg">🤖</span>
          Generate Dummy Data
        </button>
      )}

      {/* Minimized Progress Indicator */}
      {!isOpen && isGenerating && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 px-4 py-3 rounded-lg bg-white dark:bg-gray-800 shadow-xl border-2 border-emerald-500 flex items-center gap-3 z-50 hover:scale-105 transition-all"
        >
          <Loader2 className="w-5 h-5 text-emerald-600 animate-spin" />
          <div className="flex flex-col items-start">
            <span className="text-sm font-semibold text-gray-900 dark:text-white">
              Generating... {progress}%
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {completed}/{count} responses
            </span>
          </div>
        </button>
      )}

      {/* Popup Panel */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            {/* Header */}
            <div className="bg-gradient-to-r from-emerald-500 to-teal-600 p-6 relative">
              <button
                onClick={handleClose}
                className="absolute top-4 right-4 p-1 rounded-lg bg-white/20 hover:bg-white/30 transition-colors"
              >
                <X className="w-5 h-5 text-white" />
              </button>
              <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                <span className="text-3xl">🤖</span>
                Dummy Response Generator
              </h2>
              <p className="text-emerald-50 mt-2 text-sm">
                Generate realistic test responses for your survey
              </p>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {status === "idle" && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Number of Responses
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="1000"
                      value={count}
                      onChange={(e) => setCount(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-700 rounded-lg focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 dark:bg-gray-800 dark:text-white transition-all"
                      placeholder="Enter count..."
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Recommended: 10-200 responses
                    </p>
                  </div>

                  <button
                    onClick={handleGenerate}
                    disabled={count < 1}
                    className="w-full px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-semibold rounded-lg hover:shadow-lg hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 transition-all duration-200"
                  >
                    Start Generation
                  </button>
                </>
              )}

              {status === "generating" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-center gap-3 text-emerald-600 dark:text-emerald-400">
                    <Loader2 className="w-6 h-6 animate-spin" />
                    <span className="font-medium">Generating responses...</span>
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                      <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Completed</div>
                      <div className="text-2xl font-bold text-gray-900 dark:text-white">
                        {Math.round(completed)}/{count}
                      </div>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                      <div className="text-xs text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Elapsed
                      </div>
                      <div className="text-2xl font-bold text-gray-900 dark:text-white">
                        {formatTime(elapsedTime)}
                      </div>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                      <span>Progress</span>
                      <span className="font-semibold">{progress}%</span>
                    </div>
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-500 to-teal-600 transition-all duration-300 ease-out relative overflow-hidden"
                        style={{ width: `${progress}%` }}
                      >
                        <div className="absolute inset-0 bg-white/30 animate-pulse" />
                      </div>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                      <span>Est. remaining: {getEstimatedTime()}</span>
                      <span>{completed > 0 ? `${((completed / elapsedTime) * 60).toFixed(1)}/min` : '—'}</span>
                    </div>
                  </div>

                  {/* Stop Button */}
                  <button
                    onClick={handleStop}
                    className="w-full px-6 py-3 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    <StopCircle className="w-5 h-5" />
                    Stop Generation
                  </button>

                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-sm text-blue-700 dark:text-blue-300">
                    <p className="font-medium mb-1">💡 Tip</p>
                    <p>You can minimize this panel and continue working. Progress will be saved.</p>
                  </div>
                </div>
              )}

              {status === "success" && (
                <div className="space-y-4">
                  <div className="flex flex-col items-center gap-3 text-center">
                    <CheckCircle2 className="w-16 h-16 text-emerald-500" />
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                      Generation Complete!
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400">
                      Successfully generated {count} dummy responses in {formatTime(elapsedTime)}
                    </p>
                    <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-3 w-full">
                      <div className="text-sm text-emerald-700 dark:text-emerald-300">
                        <strong>Average rate:</strong> {((count / elapsedTime) * 60).toFixed(1)} responses/min
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handleReset}
                    className="w-full px-6 py-3 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-medium rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                  >
                    Generate More
                  </button>
                </div>
              )}

              {status === "stopped" && (
                <div className="space-y-4">
                  <div className="flex flex-col items-center gap-3 text-center">
                    <StopCircle className="w-16 h-16 text-orange-500" />
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                      Generation Stopped
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400">
                      Generated {Math.round(completed)} of {count} responses before stopping
                    </p>
                  </div>

                  <button
                    onClick={handleReset}
                    className="w-full px-6 py-3 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-medium rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                  >
                    Start New Generation
                  </button>
                </div>
              )}

              {status === "error" && (
                <div className="space-y-4">
                  <div className="flex flex-col items-center gap-3 text-center">
                    <AlertCircle className="w-16 h-16 text-red-500" />
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                      Generation Failed
                    </h3>
                    <p className="text-red-600 dark:text-red-400 text-sm">
                      {error}
                    </p>
                  </div>

                  <button
                    onClick={handleReset}
                    className="w-full px-6 py-3 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-medium rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                  >
                    Try Again
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}