import React from "react";
import { Server, Cloud, CheckCircle } from "lucide-react";

export const ProviderCard = ({ provider, onSelect, isSelected }) => {
  const IconComponent = provider.icon;
  
  const getProviderCategory = () => {
    const smtpProviders = ['nodemailer', 'gmail', 'outlook'];
    return smtpProviders.includes(provider.id) ? 'smtp' : 'cloud';
  };

  const getCategoryInfo = () => {
    const category = getProviderCategory();
    if (category === 'smtp') {
      return {
        icon: Server,
        label: 'SMTP',
        description: 'Direct server connection',
        color: 'text-purple-600',
        bgColor: 'bg-purple-100'
      };
    }
    return {
      icon: Cloud,
      label: 'Cloud API',
      description: 'Managed email service',
      color: 'text-blue-600',
      bgColor: 'bg-blue-100'
    };
  };

  const categoryInfo = getCategoryInfo();
  const CategoryIcon = categoryInfo.icon;

  const getPopularityBadge = () => {
    const popularProviders = {
      'sendgrid': { label: 'Popular', color: 'bg-green-500' },
      'gmail': { label: 'Most Used', color: 'bg-blue-500' },
      'mailgun': { label: 'Developer Favorite', color: 'bg-purple-500' },
      'outlook': { label: 'Business', color: 'bg-indigo-500' }
    };
    
    return popularProviders[provider.id] || null;
  };

  const popularityBadge = getPopularityBadge();

  const getProviderFeatures = () => {
    const features = {
      'sendgrid': ['High deliverability', 'Advanced analytics', 'Template engine'],
      'mailgun': ['Developer-friendly', 'Email validation', 'Powerful APIs'],
      'gmail': ['Easy setup', 'Reliable', 'Google integration'],
      'outlook': ['Microsoft integration', 'Business-focused', 'Secure'],
      'nodemailer': ['Full control', 'Custom SMTP', 'Any provider']
    };
    
    return features[provider.id] || ['Reliable email delivery'];
  };

  const features = getProviderFeatures();

  return (
    <div
      onClick={() => onSelect(provider.id)}
      className={`relative border-2 rounded-xl p-6 cursor-pointer transition-all duration-200 hover:shadow-lg group ${
        isSelected
          ? "border-blue-500 bg-blue-50 shadow-md"
          : "border-gray-200 hover:border-blue-300"
      }`}
    >
      {/* Popularity Badge */}
      {popularityBadge && (
        <div className={`absolute -top-2 left-4 px-3 py-1 ${popularityBadge.color} text-white text-xs font-medium rounded-full shadow-sm`}>
          {popularityBadge.label}
        </div>
      )}

      {/* Category Badge */}
      <div className={`absolute -top-2 right-4 flex items-center space-x-1 px-2 py-1 ${categoryInfo.bgColor} ${categoryInfo.color} text-xs font-medium rounded-full`}>
        <CategoryIcon className="h-3 w-3" />
        <span>{categoryInfo.label}</span>
      </div>

      <div className="flex items-start space-x-4">
        {/* Provider Icon */}
        <div
          className={`p-3 rounded-lg transition-colors ${
            isSelected ? "bg-blue-100" : "bg-gray-100 group-hover:bg-blue-50"
          }`}
        >
          <IconComponent
            className={`h-6 w-6 transition-colors ${
              isSelected ? "text-blue-600" : "text-gray-600 group-hover:text-blue-600"
            }`}
          />
        </div>

        {/* Provider Details */}
        <div className="flex-1">
          <div className="flex items-center space-x-2 mb-2">
            <h3 className="text-lg font-semibold text-gray-900">
              {provider.label}
            </h3>
            {isSelected && (
              <CheckCircle className="h-5 w-5 text-blue-600" />
            )}
          </div>
          
          <p className="text-sm text-gray-600 leading-relaxed mb-3">
            {provider.description}
          </p>

          {/* Features */}
          <div className="space-y-1">
            {features.slice(0, 2).map((feature, index) => (
              <div key={index} className="flex items-center space-x-2">
                <div className="h-1.5 w-1.5 bg-green-500 rounded-full"></div>
                <span className="text-xs text-gray-600">{feature}</span>
              </div>
            ))}
          </div>

          {/* Setup Difficulty Indicator */}
          <div className="mt-3 flex items-center space-x-2">
            <span className="text-xs text-gray-500">Setup:</span>
            <div className="flex space-x-1">
              {[1, 2, 3].map((level) => {
                const difficulty = provider.id === 'nodemailer' ? 3 : 
                                 ['gmail', 'outlook'].includes(provider.id) ? 2 : 1;
                return (
                  <div
                    key={level}
                    className={`h-1.5 w-3 rounded-full ${
                      level <= difficulty ? 'bg-blue-500' : 'bg-gray-200'
                    }`}
                  />
                );
              })}
            </div>
            <span className="text-xs text-gray-500">
              {provider.id === 'nodemailer' ? 'Advanced' : 
               ['gmail', 'outlook'].includes(provider.id) ? 'Medium' : 'Easy'}
            </span>
          </div>
        </div>
      </div>

      {/* Selection Indicator */}
      {isSelected && (
        <div className="absolute inset-0 rounded-xl border-2 border-blue-500 pointer-events-none">
          <div className="absolute top-2 right-2 bg-blue-500 text-white rounded-full p-1">
            <CheckCircle className="h-4 w-4" />
          </div>
        </div>
      )}
    </div>
  );
};