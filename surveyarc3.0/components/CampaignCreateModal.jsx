import React, { useState, useEffect, useRef } from 'react';

const CampaignCreateModal = ({ 
  isOpen, 
  onClose, 
  userId,
  orgId,
  onCreate, 
  lists = [], 
  contacts = [],
  surveys = [],
  onLoadLists,
  onLoadContacts,
  onLoadSurveys
}) => {
  const [formData, setFormData] = useState({
    campaignName: '',
    userId: userId,
    surveyId: '',
    channel: 'email',
    fallbackChannel: null,
    channelPriority: [],
    orgId:orgId,
    
    // Contact selection
    contactListId: '',
    contactFilters: {},
    
    // Email fields
    emailSubject: '',
    emailBodyHtml: '',
    emailFromName: '',
    emailReplyTo: '',
    
    // SMS fields
    smsMessage: '',
    
    // WhatsApp fields
    whatsappMessage: '',
    whatsappTemplateId: '',
    
    // Voice fields
    voiceScript: '',
    
    // Scheduling
    scheduledAt: null,
    
    // Metadata
    metaData: {},
  });

  const [selectedContacts, setSelectedContacts] = useState([]);
  const [showContactSelector, setShowContactSelector] = useState(false);
  
  // FIXED: Use refs to track if data has been loaded
  const hasLoadedLists = useRef(false);
  const hasLoadedContacts = useRef(false);
  const hasLoadedSurveys = useRef(false);

  useEffect (()=> {
   console.log(formData);
  })

  // FIXED: Load data only once when modal opens
  useEffect(() => {
    if (isOpen) {
      // Load lists only if not already loaded
      if (!hasLoadedLists.current && onLoadLists && lists.length === 0) {
        onLoadLists();
        hasLoadedLists.current = true;
      }
      
      // Load contacts only if not already loaded
      if (!hasLoadedContacts.current && onLoadContacts && contacts.length === 0) {
        onLoadContacts();
        hasLoadedContacts.current = true;
      }
      
      // Load surveys only if not already loaded
      if (!hasLoadedSurveys.current && onLoadSurveys && surveys.length === 0) {
        onLoadSurveys();
        hasLoadedSurveys.current = true;
      }
    }
  }, [isOpen]); // Only depend on isOpen

  const handleSubmit = async () => {
    if (!formData.campaignName || !formData.surveyId) {
      alert('Please fill in required fields: Campaign Name and Survey ID');
      return;
    }

    if (!formData.contactListId && selectedContacts.length === 0) {
      alert('Please select a contact list or individual contacts');
      return;
    }

    const submitData = {
      ...formData,
      // If using individual contacts instead of a list
      contactFilters: selectedContacts.length > 0 
        ? { contactIds: selectedContacts }
        : formData.contactFilters,
    };

  // ✅ FIX: Convert local datetime to UTC ISO string
  let scheduledAtUTC = null;
  if (formData.scheduledAt) {
    // The datetime-local input gives us a string like "2025-11-13T11:00"
    // We need to convert this to UTC
    const localDate = new Date(formData.scheduledAt);
    scheduledAtUTC = localDate.toISOString(); // Converts to UTC
  }
    try {
      await onCreate(submitData);
      // Reset form
      setFormData({
        campaignName: '',
        surveyId: '',
        channel: 'email',
        fallbackChannel: null,
        channelPriority: [],
        contactListId: '',
        contactFilters: selectedContacts.length > 0 
      ? { contactIds: selectedContacts }
      : formData.contactFilters,        emailSubject: '',
        emailBodyHtml: '',
        emailFromName: '',
        emailReplyTo: '',
        smsMessage: '',
        whatsappMessage: '',
        whatsappTemplateId: '',
        voiceScript: '',
        scheduledAt: scheduledAtUTC, // ✅ Send UTC time
        metaData: {},
      });
      setSelectedContacts([]);
      onClose();
    } catch (error) {
      console.error('Failed to create campaign:', error);
      alert('Failed to create campaign: ' + error.message);
    }
  };

  const toggleContactSelection = (contactId) => {
    setSelectedContacts(prev => 
      prev.includes(contactId) 
        ? prev.filter(id => id !== contactId)
        : [...prev, contactId]
    );
  };
// Add this helper function at the top of your component
const getUserTimezone = () => {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
};

// Add this helper to format the selected time for display
const formatScheduledTime = (isoString) => {
  if (!isoString) return '';
  const date = new Date(isoString);
  return date.toLocaleString('en-IN', { 
    dateStyle: 'medium', 
    timeStyle: 'short',
    timeZone: getUserTimezone()
  });
};
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full my-8">
        {/* Header */}
        <div className="p-6 border-b flex items-center justify-between sticky top-0 bg-white z-10 rounded-t-lg">
          <h2 className="text-2xl font-bold text-gray-900">Create New Campaign</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
          >
            ✕
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[calc(100vh-200px)] overflow-y-auto">
          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Basic Information</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Campaign Name *
                </label>
                <input
                  type="text"
                  value={formData.campaignName}
                  onChange={(e) => setFormData({ ...formData, campaignName: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Q4 Customer Satisfaction Survey"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Survey *
                </label>
                <select
                  value={formData.surveyId}
                  onChange={(e) => setFormData({ ...formData, surveyId: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select a survey...</option>
                  {surveys.map(survey => (
                    <option key={survey.survey_id} value={survey.survey_id}>
                      {survey.title || survey.name || `Survey ${survey.survey_id}`}
                    </option>
                  ))}
                </select>
                {surveys.length === 0 && (
                  <p className="text-xs text-amber-600 mt-1">
                    ⚠️ No surveys available. Please create a survey first.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Channel Configuration */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Channel Configuration</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Primary Channel *
                </label>
                <select
                  value={formData.channel}
                  onChange={(e) => setFormData({ ...formData, channel: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="email">📧 Email</option>
                  <option value="sms">💬 SMS</option>
                  <option value="whatsapp">📱 WhatsApp</option>
                  <option value="voice">📞 Voice</option>
                  <option value="multi">🔀 Multi-Channel</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Fallback Channel
                </label>
                <select
                  value={formData.fallbackChannel || ''}
                  onChange={(e) => setFormData({ ...formData, fallbackChannel: e.target.value || null })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">None</option>
                  <option value="email">📧 Email</option>
                  <option value="sms">💬 SMS</option>
                  <option value="whatsapp">📱 WhatsApp</option>
                  <option value="voice">📞 Voice</option>
                </select>
              </div>
            </div>
          </div>

          {/* Recipients */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Recipients</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Contact List
                </label>
                <select
                  value={formData.contactListId}
                  onChange={(e) => {
                    setFormData({ ...formData, contactListId: e.target.value });
                    setSelectedContacts([]); // Clear individual selections
                  }}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select a list...</option>
                  {lists.map(list => (
                    <option key={list.listId} value={list.listId}>
                      {list.name || list.listName} ({list.contacts?.length || 0} contacts)
                    </option>
                  ))}
                </select>
              </div>

              <div className="text-center text-gray-500 text-sm">OR</div>

              <div>
                <button
                  type="button"
                  onClick={() => setShowContactSelector(!showContactSelector)}
                  className="w-full px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-500 hover:text-blue-600 transition-colors"
                >
                  {selectedContacts.length > 0 
                    ? `${selectedContacts.length} contacts selected` 
                    : 'Select Individual Contacts'}
                </button>
              </div>

              {showContactSelector && (
                <div className="border rounded-lg p-4 max-h-60 overflow-y-auto bg-gray-50">
                  <div className="space-y-2">
                    {contacts.length === 0 ? (
                      <p className="text-sm text-gray-500 text-center py-4">No contacts available</p>
                    ) : (
                      contacts.map(contact => (
                        <label
                          key={contact.contactId}
                          className="flex items-center gap-3 p-2 hover:bg-white rounded cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={selectedContacts.includes(contact.contactId)}
                            onChange={() => toggleContactSelection(contact.contactId)}
                            className="w-4 h-4 text-blue-600"
                          />
                          <div className="flex-1">
                            <div className="font-medium text-sm text-gray-900">{contact.name}</div>
                            <div className="text-xs text-gray-500">{contact.email}</div>
                          </div>
                        </label>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Email Configuration */}
          {(formData.channel === 'email' || formData.channel === 'multi') && (
            <div className="space-y-4 p-4 bg-blue-50 rounded-lg">
              <h3 className="font-semibold text-gray-900">📧 Email Configuration</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    From Name
                  </label>
                  <input
                    type="text"
                    value={formData.emailFromName}
                    onChange={(e) => setFormData({ ...formData, emailFromName: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Your Company"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Reply-To Email
                  </label>
                  <input
                    type="email"
                    value={formData.emailReplyTo}
                    onChange={(e) => setFormData({ ...formData, emailReplyTo: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="reply@company.com"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Subject Line
                </label>
                <input
                  type="text"
                  value={formData.emailSubject}
                  onChange={(e) => setFormData({ ...formData, emailSubject: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="We'd love your feedback!"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Body (HTML)
                </label>
                <textarea
                  value={formData.emailBodyHtml}
                  onChange={(e) => setFormData({ ...formData, emailBodyHtml: e.target.value })}
                  rows={8}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                  placeholder="<p>Hi {{name}},</p><p>We'd love to hear your feedback...</p>"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Available variables: {'{'}{'{'} name {'}'}{'}'},  {'{'}{'{'} email {'}'}{'}'}, {'{'}{'{'} survey_link {'}'}{'}'}
                </p>
              </div>
            </div>
          )}

          {/* SMS Configuration */}
          {(formData.channel === 'sms' || formData.channel === 'multi') && (
            <div className="space-y-4 p-4 bg-purple-50 rounded-lg">
              <h3 className="font-semibold text-gray-900">💬 SMS Configuration</h3>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  SMS Message
                </label>
                <textarea
                  value={formData.smsMessage}
                  onChange={(e) => setFormData({ ...formData, smsMessage: e.target.value })}
                  rows={4}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Hi {{name}}, please take our quick survey: {{survey_link}}"
                  maxLength={160}
                />
                <p className="text-xs text-gray-500 mt-1">
                  {formData.smsMessage.length}/160 characters
                </p>
              </div>
            </div>
          )}

          {/* WhatsApp Configuration */}
          {(formData.channel === 'whatsapp' || formData.channel === 'multi') && (
            <div className="space-y-4 p-4 bg-green-50 rounded-lg">
              <h3 className="font-semibold text-gray-900">📱 WhatsApp Configuration</h3>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Template ID
                </label>
                <input
                  type="text"
                  value={formData.whatsappTemplateId}
                  onChange={(e) => setFormData({ ...formData, whatsappTemplateId: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="template_123"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  WhatsApp Message
                </label>
                <textarea
                  value={formData.whatsappMessage}
                  onChange={(e) => setFormData({ ...formData, whatsappMessage: e.target.value })}
                  rows={4}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="Hi {{name}}, we'd love your feedback..."
                />
              </div>
            </div>
          )}

          {/* Voice Configuration */}
          {(formData.channel === 'voice' || formData.channel === 'multi') && (
            <div className="space-y-4 p-4 bg-orange-50 rounded-lg">
              <h3 className="font-semibold text-gray-900">📞 Voice Configuration</h3>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Voice Script
                </label>
                <textarea
                  value={formData.voiceScript}
                  onChange={(e) => setFormData({ ...formData, voiceScript: e.target.value })}
                  rows={6}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                  placeholder="Hello {{name}}, this is a call from [Company]. We'd like to get your feedback..."
                />
              </div>
            </div>
          )}

       {/* Scheduling */}
<div className="space-y-4">
  <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">
    Scheduling (Optional)
  </h3>
  
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-2">
      Schedule Send Time
      <span className="text-xs text-gray-500 ml-2">
        (Your timezone: {getUserTimezone()})
      </span>
    </label>
    <input
      type="datetime-local"
      value={formData.scheduledAt || ''}
      onChange={(e) => setFormData({ ...formData, scheduledAt: e.target.value || null })}
      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
      min={new Date().toISOString().slice(0, 16)} // ✅ Prevent past dates
    />
    <p className="text-xs text-gray-500 mt-1">
      Leave empty to send immediately, or schedule for a specific date and time
    </p>
    
    {/* ✅ Show what time will be scheduled in UTC */}
    {formData.scheduledAt && (
      <div className="mt-2 p-2 bg-blue-50 rounded text-xs text-blue-700">
        ℹ️ Will be sent at: <strong>{formatScheduledTime(new Date(formData.scheduledAt).toISOString())}</strong>
        <br />
        <span className="text-gray-600">
          (Server time: {new Date(formData.scheduledAt).toISOString()})
        </span>
      </div>
    )}
  </div>
</div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t bg-gray-50 flex items-center justify-between rounded-b-lg">
          <div className="text-sm text-gray-600">
            {formData.contactListId && (
              <span>📋 Using list</span>
            )}
            {selectedContacts.length > 0 && (
              <span>👥 {selectedContacts.length} contacts selected</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!formData.campaignName || !formData.surveyId || (!formData.contactListId && selectedContacts.length === 0)}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Create Campaign
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CampaignCreateModal;