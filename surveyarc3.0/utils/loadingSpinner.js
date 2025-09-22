import { Loader2 } from "lucide-react";

/* ------------------------------ Loading Components ------------------------------ */
export const LoadingSpinner = ({ size = "sm", className = "" }) => {
  const sizeClasses = {
    sm: "w-4 h-4",
    md: "w-6 h-6",
    lg: "w-8 h-8",
    xl: "w-12 h-12"
  };
  return (
    <Loader2 className={`animate-spin ${sizeClasses[size]} ${className}`} />
  );
};