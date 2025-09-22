// EmailConfigurationsTable.jsx
import React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper
} from "@mui/material";
import { Star, CheckCircle, Edit, Trash2, AlertTriangle, Server, Cloud } from "lucide-react";

export default function EmailConfigurationsTable({
  emailConfigurations = [],
  providers = [],
  handleEdit,
  handleDelete,
  handleSetDefault,
  setOpenProviderList
}) {
  if (emailConfigurations.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
        <div className="text-gray-400 mb-4">
          <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
            />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">No email configurations</h3>
        <p className="text-gray-600 mb-4">
          Get started by adding your first email service configuration.
        </p>
        <button
          onClick={() => setOpenProviderList(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          Add Your First Configuration
        </button>
      </div>
    );
  }

  const getProviderTypeIcon = (provider) => {
    const smtpProviders = ['nodemailer', 'gmail', 'outlook'];
    if (smtpProviders.includes(provider)) {
      return <Server className="h-3 w-3 text-gray-500" />;
    }
    return <Cloud className="h-3 w-3 text-blue-500" />;
  };

  const getProviderTypeLabel = (provider) => {
    const smtpProviders = ['nodemailer', 'gmail', 'outlook'];
    return smtpProviders.includes(provider) ? 'SMTP' : 'Cloud API';
  };

  const formatLastUpdated = (timestamp) => {
    if (!timestamp) return 'Unknown';
    
    try {
      const date = new Date(timestamp);
      const now = new Date();
      const diffInHours = (now - date) / (1000 * 60 * 60);
      
      if (diffInHours < 1) {
        return 'Just now';
      } else if (diffInHours < 24) {
        return `${Math.floor(diffInHours)} hours ago`;
      } else if (diffInHours < 168) { // 7 days
        return `${Math.floor(diffInHours / 24)} days ago`;
      } else {
        return date.toLocaleDateString();
      }
    } catch (error) {
      return 'Unknown';
    }
  };

  const getConfigurationStatus = (config) => {
    // Basic validation - you can enhance this based on your needs
    const requiredFields = ['fromEmail', 'fromName'];
    const hasRequiredFields = requiredFields.every(field => config[field]);
    
    if (!hasRequiredFields) {
      return {
        icon: AlertTriangle,
        text: 'Incomplete',
        color: 'text-orange-600',
        bgColor: 'bg-orange-100'
      };
    }
    
    return {
      icon: CheckCircle,
      text: 'Active',
      color: 'text-green-600',
      bgColor: 'bg-green-100'
    };
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <TableContainer component={Paper} className="rounded-lg">
        <Table>
          <TableHead>
            <TableRow>
              <TableCell><strong>Configuration</strong></TableCell>
              <TableCell><strong>Provider & Type</strong></TableCell>
              <TableCell><strong>From Details</strong></TableCell>
              <TableCell><strong>Status</strong></TableCell>
              <TableCell><strong>Last Updated</strong></TableCell>
              <TableCell><strong>Actions</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {emailConfigurations.map((config) => {
              const providerInfo = providers.find(p => p.id === config.provider);
              const status = getConfigurationStatus(config);
              const StatusIcon = status.icon;
              
              return (
                <TableRow key={config.id || config.updatedAt} className="hover:bg-gray-50">
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <span className="font-medium text-gray-900">
                        {config.name || config.fromName || 'Unnamed Configuration'}
                      </span>
                      {config.isDefault && (
                        <div className="flex items-center space-x-1 bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full text-xs font-medium">
                          <Star className="h-3 w-3" />
                          <span>Default</span>
                        </div>
                      )}
                    </div>
                  </TableCell>
                  
                  <TableCell>
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        {providerInfo?.icon && <providerInfo.icon className="h-4 w-4 text-gray-600" />}
                        <span className="font-medium text-gray-900">
                          {providerInfo?.label || config.provider}
                        </span>
                      </div>
                      <div className="flex items-center space-x-1">
                        {getProviderTypeIcon(config.provider)}
                        <span className="text-xs text-gray-500">
                          {getProviderTypeLabel(config.provider)}
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  
                  <TableCell>
                    <div className="space-y-1">
                      <div className="text-sm font-medium text-gray-900">
                        {config.fromName || 'No name set'}
                      </div>
                      <div className="text-xs text-gray-500">
                        {config.fromEmail || 'No email set'}
                      </div>
                    </div>
                  </TableCell>
                  
                  <TableCell>
                    <div className={`flex items-center space-x-1 ${status.color}`}>
                      <StatusIcon className="h-4 w-4" />
                      <span className="text-sm font-medium">{status.text}</span>
                    </div>
                  </TableCell>
                  
                  <TableCell>
                    <span className="text-sm text-gray-600">
                      {formatLastUpdated(config.updatedAt)}
                    </span>
                  </TableCell>
                  
                  <TableCell>
                    <div className="flex items-center space-x-1">
                      {!config.isDefault && (
                        <button
                          onClick={() => handleSetDefault(config.id)}
                          className="p-1 text-yellow-600 hover:text-yellow-800 hover:bg-yellow-50 rounded transition-colors"
                          title="Set as default"
                        >
                          <Star className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleEdit(config)}
                        className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
                        title="Edit configuration"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(config.id)}
                        className="p-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors"
                        title="Delete configuration"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </div>
  );
}
