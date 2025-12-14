"use client";

import React, { useState } from "react";
import PanelIntegrationPage from "@/components/panel/PanelIntegrationPage";
import PanelOverview from "@/components/panel/PanelOverview";

const page = () => {
  const [showIntegration, setShowIntegration] = useState(false);
  const [editingSourceId, setEditingSourceId] = useState(null);

  const handleAddPanel = () => {
    setEditingSourceId(null); // create new
    setShowIntegration(true);
  };

  const handleEditPanel = (sourceId) => {
    setEditingSourceId(sourceId); // open editor for existing
    setShowIntegration(true);
  };

  const handleCloseIntegration = () => {
    setShowIntegration(false);
    setEditingSourceId(null);
  };

  return (
    <div>
      {/* Pass handlers so PanelOverview can open the integration editor */}
      <PanelOverview onAddPanel={handleAddPanel} onEditPanel={handleEditPanel} />

      {/* Render integration page only when requested */}
      {showIntegration && (
        <div className="mt-6">
          <PanelIntegrationPage
            sourceId={editingSourceId}
            onClose={handleCloseIntegration}
          />
        </div>
      )}
    </div>
  );
};

export default page;
