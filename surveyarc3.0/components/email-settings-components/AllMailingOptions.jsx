"use client";
import React, { useCallback, useEffect, useState } from "react";
import {
  CheckCircle,
  AlertCircle,
  Eye,
  EyeOff,
  ArrowLeft,
  Plus,
} from "lucide-react";

import Loading from "@/app/[locale]/loading";

import { db } from "@/firebase/firebase";
import { decrypt, encrypt } from "@/utils/encryption";
import { useRouteParams } from "@/utils/getPaths";
import { doc, getDoc, updateDoc } from "firebase/firestore";

import { FiDelete } from "react-icons/fi";
import { providers } from "@/utils/emailServiceProviders";
import { ProviderCard } from "./MailProviderCards";
import EmailConfigurationsTable from "./EmailConfigurationsTable";

// Get encryption key from environment variable
const ENCRYPTION_KEY = process.env.NEXT_PUBLIC_EMAIL_DECODING_KEY || "qwertyhnbgvfcdweds";



const FormField = ({
  field,
  value,
  onChange,
  showPassword,
  togglePassword,
  error,
}) => {
  const isPassword = field.type === "password";
  const isSelect = field.type === "select";
  const isReadonly = field.readonly;

  // Set default values for readonly fields
  const fieldValue = value || field.value || "";

  if (isSelect) {
    return (
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          {field.label}
          {field.required && <span className="text-red-500 ml-1">*</span>}
        </label>
        <select
          name={field.name}
          value={fieldValue}
          onChange={onChange}
          disabled={isReadonly}
          className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
            error
              ? "border-red-300 focus:ring-red-500 focus:border-red-500"
              : "border-gray-300"
          } ${isReadonly ? "bg-gray-100 cursor-not-allowed" : ""}`}
        >
          <option value="">{field.placeholder || "Select an option"}</option>
          {field.options?.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">
        {field.label}
        {field.required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <div className="relative">
        <input
          type={isPassword ? (showPassword ? "text" : "password") : field.type}
          name={field.name}
          value={fieldValue}
          onChange={onChange}
          placeholder={field.placeholder}
          readOnly={isReadonly}
          className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
            error
              ? "border-red-300 focus:ring-red-500 focus:border-red-500"
              : "border-gray-300"
          } ${isPassword ? "pr-10" : ""} ${
            isReadonly ? "bg-gray-100 cursor-not-allowed" : ""
          }`}
        />
        {isPassword && (
          <button
            type="button"
            onClick={togglePassword}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        )}
      </div>
      {isReadonly && (
        <p className="text-xs text-gray-500">This field is automatically configured for this provider</p>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
};

const Toast = ({ message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div
      className={`fixed top-4 right-4 p-4 rounded-lg shadow-lg flex items-center space-x-2 z-50 ${
        type === "success"
          ? "bg-green-50 border border-green-200"
          : "bg-red-50 border border-red-200"
      }`}
    >
      {type === "success" ? (
        <CheckCircle className="h-5 w-5 text-green-600" />
      ) : (
        <AlertCircle className="h-5 w-5 text-red-600" />
      )}
      <span
        className={`text-sm font-medium ${
          type === "success" ? "text-green-800" : "text-red-800"
        }`}
      >
        {message}
      </span>
    </div>
  );
};

export default function EmailProviderConfiguration() {
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [showPasswords, setShowPasswords] = useState({});
  const [errors, setErrors] = useState({});
  const [toast, setToast] = useState(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [openProviderList, setOpenProviderList] = useState(false);
  const [emailConfigurations, setEmailConfigurations] = useState([]);
  const [editingConfigId, setEditingConfigId] = useState(null);
  const [showConfigForm, setShowConfigForm] = useState(false);

  const { orgId } = useRouteParams();

  // Load existing configurations
  useEffect(() => {
    if (!orgId) return;

    const loadConfigurations = async () => {
      try {
        const ref = doc(db, "organizations", orgId);
        const snap = await getDoc(ref);

        if (snap.exists()) {
          const data = snap.data();
          const configs = data?.emailConfigurations;

          // Support both array and object (map) formats
          const configArray = Array.isArray(configs)
            ? configs
            : typeof configs === "object" && configs !== null
            ? Object.entries(configs).map(([id, config]) => ({ id, ...config }))
            : [];

          const decryptedConfigs = configArray.map((config) => {
            const decryptedData = { ...config };
            Object.keys(config || {}).forEach((key) => {
              if (
                ["provider", "updatedAt", "id", "isDefault", "name"].includes(key)
              )
                return;

              if (
                key?.toLowerCase()?.includes("apikey") ||
                key?.toLowerCase()?.includes("pass") ||
                key?.toLowerCase()?.includes("secret")
              ) {
                try {
                  // Pass encryption key to decrypt function
                  decryptedData[key] = decrypt(config[key], ENCRYPTION_KEY);
                } catch {
                  decryptedData[key] = config[key]; // fallback in case decryption fails
                }
              }
            });
            return decryptedData;
          });

          setEmailConfigurations(decryptedConfigs);
        }
      } catch (error) {
        console.error("Failed to load configurations:", error);
        setToast({
          message: "Failed to load existing configurations",
          type: "error",
        });
      } finally {
        setInitialLoading(false);
      }
    };

    loadConfigurations();
  }, [orgId]);

  const handleProviderSelect = useCallback(
    (providerId) => {
      if (hasUnsavedChanges) {
        const confirmed = window.confirm(
          "You have unsaved changes. Are you sure you want to switch providers?"
        );
        if (!confirmed) return;
      }

      setSelectedProvider(providerId);
      
      // Initialize form data with default values from provider fields
      const provider = providers.find((p) => p.id === providerId);
      const initialData = {};
      provider?.fields.forEach((field) => {
        if (field.value) {
          initialData[field.name] = field.value;
        }
      });
      
      setFormData(initialData);
      setErrors({});
      setShowPasswords({});
      setHasUnsavedChanges(false);
      setShowConfigForm(true);
      setOpenProviderList(false);
    },
    [hasUnsavedChanges]
  );

  const handleInputChange = useCallback(
    (e) => {
      const { name, value } = e.target;
      setFormData((prev) => ({ ...prev, [name]: value }));
      setHasUnsavedChanges(true);

      // Clear error when user starts typing
      if (errors[name]) {
        setErrors((prev) => ({ ...prev, [name]: null }));
      }
    },
    [errors]
  );

  const togglePasswordVisibility = useCallback((fieldName) => {
    setShowPasswords((prev) => ({ ...prev, [fieldName]: !prev[fieldName] }));
  }, []);

  const validateForm = useCallback(() => {
    const provider = providers.find((p) => p.id === selectedProvider);
    const newErrors = {};

    // Validate configuration name
    if (!formData.name?.trim()) {
      newErrors.name = "Configuration name is required";
    }

    provider.fields.forEach((field) => {
      const value = formData[field.name] || field.value || "";
      
      if (field.required && !value?.trim()) {
        newErrors[field.name] = `${field.label} is required`;
      } else if (field.type === "email" && value) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
          newErrors[field.name] = "Please enter a valid email address";
        }
      } else if (field.type === "number" && value) {
        if (isNaN(value) || value <= 0) {
          newErrors[field.name] = "Please enter a valid port number";
        }
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [selectedProvider, formData]);

  const generateConfigId = () => {
    return `config_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      setToast({
        message: "Please fix the errors before saving",
        type: "error",
      });
      return;
    }

    setLoading(true);

    try {
      const provider = providers.find((p) => p.id === selectedProvider);
      const encryptedData = { ...formData };
      
      // Include default values from provider fields
      provider.fields.forEach((field) => {
        if (field.value && !formData[field.name]) {
          encryptedData[field.name] = field.value;
        }
      });

      Object.keys(encryptedData).forEach((key) => {
        const field = provider?.fields.find((f) => f.name === key);
        if (field?.sensitive) {
          // Pass encryption key to encrypt function
          encryptedData[key] = encrypt(encryptedData[key], ENCRYPTION_KEY);
        }
      });

      const configId = editingConfigId || generateConfigId();
      const newConfig = {
        id: configId,
        provider: selectedProvider,
        name: formData.name,
        ...encryptedData,
        updatedAt: Date.now(),
        isDefault: emailConfigurations.length === 0 || formData.isDefault || false,
      };

      let updatedConfigs;
      if (editingConfigId) {
        // Update existing configuration
        updatedConfigs = emailConfigurations.map(config => 
          config.id === editingConfigId ? newConfig : config
        );
      } else {
        // Add new configuration
        updatedConfigs = [...emailConfigurations, newConfig];
      }

      // If this is set as default, remove default from others
      if (newConfig.isDefault) {
        updatedConfigs = updatedConfigs.map(config => ({
          ...config,
          isDefault: config.id === configId
        }));
      }

      await updateDoc(doc(db, "organizations", orgId), {
        emailConfigurations: updatedConfigs.map(config => {
          const configToSave = { ...config };
          Object.keys(configToSave).forEach(key => {
            if (key === "provider" || key === "updatedAt" || key === "id" || key === "isDefault" || key === "name") return;
            const field = providers
              .find((p) => p.id === config.provider)
              ?.fields.find((f) => f.name === key);
         
          });
          return configToSave;
        })
      });

      setEmailConfigurations(updatedConfigs);
      setToast({
        message: editingConfigId ? "Configuration updated successfully!" : "Configuration saved successfully!",
        type: "success",
      });
      setHasUnsavedChanges(false);
      setShowConfigForm(false);
      setEditingConfigId(null);
      setFormData({});
      setSelectedProvider(null);
    } catch (error) {
      console.error("Save failed:", error);
      setToast({
        message: "Failed to save configuration. Please try again.",
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (config) => {
    setEditingConfigId(config.id);
    setSelectedProvider(config.provider);
    setFormData(config);
    setShowConfigForm(true);
    setHasUnsavedChanges(false);
  };

  const handleDelete = async (configId) => {
    if (!confirm("Are you sure you want to delete this configuration?")) return;

    try {
      const orgRef = doc(db, "organizations", orgId);
      const snap = await getDoc(orgRef);
      
      if (!snap.exists()) {
        console.warn("Organization not found.");
        setToast({
          message: "Organization not found.",
          type: "error",
        });
        return;
      }

      const existingConfigs = snap.data().emailConfigurations || [];
      
      // Ensure it's an array
      if (!Array.isArray(existingConfigs)) {
        throw new Error("emailConfigurations is not an array.");
      }

      // Find the config being deleted to check if it's default
      const deletedConfig = existingConfigs.find((c) => c.id === configId);
      
      // Filter out the config to delete
      const updatedConfigs = existingConfigs.filter((c) => c.id !== configId);
      
      // If we deleted the default config and there are remaining configs, make the first one default
      if (deletedConfig?.isDefault && updatedConfigs.length > 0) {
        updatedConfigs[0] = { ...updatedConfigs[0], isDefault: true };
      }

      // Update in Firestore
      await updateDoc(orgRef, {
        emailConfigurations: updatedConfigs,
      });

      // Update local state
      setEmailConfigurations(updatedConfigs);
      setToast({
        message: "Configuration deleted successfully!",
        type: "success",
      });
    } catch (err) {
      console.error("Delete failed:", err);
      setToast({
        message: `Failed to delete configuration: ${err.message}`,
        type: "error",
      });
    }
  };

  const handleSetDefault = async (configId) => {
    try {
      const updatedConfigs = emailConfigurations.map(config => ({
        ...config,
        isDefault: config.id === configId
      }));

      await updateDoc(doc(db, "organizations", orgId), {
        emailConfigurations: updatedConfigs
      });

      setEmailConfigurations(updatedConfigs);
      setToast({
        message: "Default configuration updated successfully!",
        type: "success",
      });
    } catch (error) {
      console.error("Set default failed:", error);
      setToast({
        message: "Failed to set default configuration. Please try again.",
        type: "error",
      });
    }
  };

  const handleBackToConfigs = () => {
    if (hasUnsavedChanges) {
      const confirmed = window.confirm(
        "You have unsaved changes. Are you sure you want to go back?"
      );
      if (!confirmed) return;
    }

    setShowConfigForm(false);
    setSelectedProvider(null);
    setFormData({});
    setErrors({});
    setShowPasswords({});
    setHasUnsavedChanges(false);
    setEditingConfigId(null);
  };

  if (initialLoading) {
    return (
        <div className="text-center">
          <Loading />
        </div>
    );
  }

  const selectedProviderData = providers?.find((p) => p.id === selectedProvider);

  return (
    <div className="w-full bg-white mx-auto p-6 ">
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* Provider Selection Modal */}
      {openProviderList && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-40 flex items-center justify-center">
          <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-5xl max-h-[90vh] overflow-auto">
            <div className="space-y-6">
              <div className="text-center">
                <div className="flex justify-between items-center mb-2">
                  <h1 className="text-2xl font-bold text-gray-900">
                    Choose Your Email Provider
                  </h1>
                  <FiDelete
                    className="cursor-pointer text-xl text-gray-600 hover:text-red-500"
                    onClick={() => setOpenProviderList(false)}
                  />
                </div>
                <p className="text-gray-600 text-sm">
                  Select an email service provider to configure your
                  organization's email settings.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {providers.map((provider) => (
                  <ProviderCard
                    key={provider.id}
                    provider={provider}
                    onSelect={handleProviderSelect}
                    isSelected={false}
                    setOpenProviderList={setOpenProviderList}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {!showConfigForm ? (
        // Main configurations table view
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Email Configurations</h1>
              <p className="text-gray-600">Manage your organization's email service configurations</p>
            </div>
            <button
              onClick={() => setOpenProviderList(true)}
              className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="h-4 w-4" />
              <span>Add Configuration</span>
            </button>
          </div>

          <EmailConfigurationsTable
            emailConfigurations={emailConfigurations}
            providers={providers}
            handleEdit={handleEdit}
            handleDelete={handleDelete}
            handleSetDefault={handleSetDefault}
            setOpenProviderList={setOpenProviderList}
          />

        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <button
              onClick={handleBackToConfigs}
              className="flex items-center space-x-2 text-blue-600 hover:text-blue-800 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Configurations</span>
            </button>

            {hasUnsavedChanges && (
              <div className="flex items-center space-x-2 text-amber-600">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm">Unsaved changes</span>
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center space-x-3 mb-6">
              <div className="p-2 bg-blue-100 rounded-lg">
                <selectedProviderData.icon className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  {editingConfigId ? 'Edit' : 'Configure'} {selectedProviderData.label}
                </h2>
                <p className="text-sm text-gray-600">
                  {selectedProviderData.description}
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {/* Configuration Name Field */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Configuration Name
                  <span className="text-red-500 ml-1">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name || ""}
                  onChange={handleInputChange}
                  placeholder="e.g., Primary Gmail, Support Outlook"
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
                    errors.name
                      ? "border-red-300 focus:ring-red-500 focus:border-red-500"
                      : "border-gray-300"
                  }`}
                />
                {errors.name && <p className="text-sm text-red-600">{errors.name}</p>}
              </div>

              {/* Set as Default Checkbox */}
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="isDefault"
                  name="isDefault"
                  checked={formData.isDefault || emailConfigurations.length === 0}
                  onChange={(e) => setFormData(prev => ({ ...prev, isDefault: e.target.checked }))}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="isDefault" className="text-sm font-medium text-gray-700">
                  Set as default configuration
                </label>
              </div>

              {/* Provider-specific fields */}
              {selectedProviderData.fields.map((field) => (
                <FormField
                  key={field.name}
                  field={field}
                  value={formData[field.name]}
                  onChange={handleInputChange}
                  showPassword={showPasswords[field.name]}
                  togglePassword={() => togglePasswordVisibility(field.name)}
                  error={errors[field.name]}
                />
              ))}
            </div>

            <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-200">
              <div className="text-sm text-gray-500">
                All sensitive data is encrypted before storage
              </div>
              <button
                onClick={handleSave}
                disabled={loading || Object.keys(errors).length > 0}
                className="flex items-center space-x-2 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {loading && <Loading />}
                <span>{loading ? "Saving..." : editingConfigId ? "Update Configuration" : "Save Configuration"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}