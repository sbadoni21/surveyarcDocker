import React from "react";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";

export default function DashboardSkeleton() {
  return (
    <div className="min-h-screen p-6 sm:p-10 space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <Skeleton height={36} width={200} />
          <Skeleton height={20} width={150} style={{ marginTop: "0.5rem" }} />
        </div>
        <Skeleton circle height={48} width={48} />
      </div>

      <div className="flex justify-between items-center p-4 border-l-4 rounded-lg bg-[#FFF7ED] dark:bg-[#1A1A1E]">
        <div className="flex items-center gap-2">
          <Skeleton circle height={40} width={40} />
          <div>
            <Skeleton height={16} width={180} />
            <Skeleton height={10} width={120} style={{ marginTop: "0.3rem" }} />
          </div>
        </div>
        <Skeleton height={36} width={120} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Skeleton height={100} />
        <Skeleton height={100} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Skeleton height={80} />
        <Skeleton height={80} />
        <Skeleton height={80} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Skeleton height={80} />
        <Skeleton height={80} />
      </div>
    </div>
  );
}
