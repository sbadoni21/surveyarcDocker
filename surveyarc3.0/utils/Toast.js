import React, { useEffect } from "react";
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from "lucide-react";

const SEVERITY_STYLES = {
  success: {
    bgColor: "bg-green-50",
    borderColor: "border-green-200",
    textColor: "text-green-800",
    icon: CheckCircle,
    iconColor: "text-green-500",
  },
  error: {
    bgColor: "bg-red-50",
    borderColor: "border-red-200",
    textColor: "text-red-800",
    icon: AlertCircle,
    iconColor: "text-red-500",
  },
  warning: {
    bgColor: "bg-yellow-50",
    borderColor: "border-yellow-200",
    textColor: "text-yellow-800",
    icon: AlertTriangle,
    iconColor: "text-yellow-500",
  },
  info: {
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
    textColor: "text-blue-800",
    icon: Info,
    iconColor: "text-blue-500",
  },
};

export function Toast({ open, message, severity = "info", onClose, duration = 6000 }) {
  useEffect(() => {
    if (open && duration > 0) {
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }
  }, [open, duration, onClose]);

  if (!open) return null;

  const style = SEVERITY_STYLES[severity] || SEVERITY_STYLES.info;
  const Icon = style.icon;

  return (
    <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50 animate-slide-up">
      <div
        className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border ${style.bgColor} ${style.borderColor} min-w-[300px] max-w-[500px]`}
      >
        <Icon className={`w-5 h-5 flex-shrink-0 ${style.iconColor}`} />
        <span className={`flex-1 text-sm font-medium ${style.textColor}`}>
          {message}
        </span>
        <button
          onClick={onClose}
          className={`flex-shrink-0 p-1 rounded hover:bg-black hover:bg-opacity-10 transition-colors ${style.textColor}`}
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}