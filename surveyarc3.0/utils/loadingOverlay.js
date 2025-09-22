import { LoadingSpinner } from "./loadingSpinner";

export const LoadingOverlay = ({ message = "Loading..." }) => (
  <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-10">
    <div className="flex items-center gap-2 text-gray-600">
      <LoadingSpinner size="md" />
      <span>{message}</span>
    </div>
  </div>
);