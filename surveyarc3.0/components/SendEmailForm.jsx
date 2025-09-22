"use client"
import React, { useEffect, useState } from "react";
import {
  getDocs,
  collection,
  doc,
  getDoc,
  addDoc,
} from "firebase/firestore";
import { db } from "@/firebase/firebase";

// Helper function to remove undefined values from objects
const cleanObject = (obj) => {
  if (obj === null || obj === undefined) return null;
  if (Array.isArray(obj)) {
    return obj.map(cleanObject);
  }
  if (typeof obj === 'object') {
    const cleaned = {};
    Object.keys(obj).forEach(key => {
      const value = obj[key];
      if (value !== undefined) {
        cleaned[key] = cleanObject(value);
      }
    });
    return cleaned;
  }
  return obj;
};

export default function SendEmailForm({ orgId }) {
  const [lists, setLists] = useState([]);
  const [configs, setConfigs] = useState([]);
  const [selectedListId, setSelectedListId] = useState("");
  const [selectedConfigId, setSelectedConfigId] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ sent: 0, total: 0, errors: 0 });
  const [showProgress, setShowProgress] = useState(false);

  useEffect(() => {
    const fetchMeta = async () => {
      try {
        const listSnap = await getDocs(collection(db, "organizations", orgId, "lists"));
        const configSnap = await getDoc(doc(db, "organizations", orgId));
        setLists(listSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        setConfigs(configSnap.data()?.emailConfigurations || []);
      } catch (error) {
        console.error("Error fetching data:", error);
        alert("Failed to load email lists and configurations");
      }
    };
    fetchMeta();
  }, [orgId]);

  const validateEmail = (email) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  const handleSendEmails = async () => {
    if (!selectedListId || !selectedConfigId || !subject || !body) {
      alert("Please fill all fields");
      return;
    }

    const selectedList = lists.find((l) => l.id === selectedListId);
    const selectedConfig = configs.find((c) => c.id === selectedConfigId);

    if (!selectedList || !selectedList.emails || selectedList.emails.length === 0) {
      alert("Selected list has no emails");
      return;
    }

    // Validate emails
    const validEmails = selectedList.emails.filter(contact => 
      contact.email && validateEmail(contact.email)
    );

    if (validEmails.length === 0) {
      alert("No valid email addresses found in the selected list");
      return;
    }

    if (validEmails.length !== selectedList.emails.length) {
      const proceed = confirm(`Found ${selectedList.emails.length - validEmails.length} invalid email addresses. Continue with ${validEmails.length} valid emails?`);
      if (!proceed) return;
    }

    setLoading(true);
    setShowProgress(true);
    setProgress({ sent: 0, total: validEmails.length, errors: 0 });

    const results = [];
    const batchSize = 5; // Send emails in batches to avoid overwhelming the server
    
    try {
      for (let i = 0; i < validEmails.length; i += batchSize) {
        const batch = validEmails.slice(i, i + batchSize);
        
        const batchPromises = batch.map(async (contact) => {
          try {
            const emailData = {
              orgId: orgId || '',
              providerId: selectedConfig.provider || '',
              to: contact.email || '',
              subject: subject.replace(/{{name}}/g, contact.name || ''),
              html: buildEmailBody(contact),
              text: buildPlainTextBody(contact),
            };

            const response = await fetch("/api/send-bulk-emails", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(cleanObject(emailData)),
            });

            const result = await response.json();
            
            if (response.ok) {
              setProgress(prev => ({ ...prev, sent: prev.sent + 1 }));
              return { success: true, email: contact.email || '', error: null };
            } else {
              setProgress(prev => ({ ...prev, errors: prev.errors + 1 }));
              return { success: false, email: contact.email || '', error: result.error || 'Unknown error' };
            }
          } catch (error) {
            setProgress(prev => ({ ...prev, errors: prev.errors + 1 }));
            return { success: false, email: contact.email || '', error: error.message || 'Network error' };
          }
        });

        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);

        // Add delay between batches to respect rate limits
        if (i + batchSize < validEmails.length) {
          await delay(1000); // 1 second delay between batches
        }
      }

      // Clean and log campaign results
      const cleanResults = results.map(result => ({
        success: Boolean(result.success),
        email: result.email || '',
        error: result.error || null,
      }));

      const campaignData = {
        listId: selectedListId || '',
        configId: selectedConfigId || '',
        subject: subject || '',
        body: body || '',
        totalEmails: validEmails.length || 0,
        successfulEmails: results.filter(r => r.success).length || 0,
        failedEmails: results.filter(r => !r.success).length || 0,
        results: cleanResults,
        timestamp: new Date(),
        status: 'completed'
      };

      await addDoc(collection(db, "organizations", orgId, "campaigns"), campaignData);

      const successCount = results.filter(r => r.success).length;
      const errorCount = results.filter(r => !r.success).length;
      
      alert(`Campaign completed!\nSuccessful: ${successCount}\nFailed: ${errorCount}`);
      
    } catch (err) {
      console.error("Error sending emails:", err);
      alert("Failed to send emails: " + err.message);
    } finally {
      setLoading(false);
      setTimeout(() => setShowProgress(false), 3000); // Hide progress after 3 seconds
    }
  };

  const buildEmailBody = (contact) => {
    const trackingPixel = `<img src="https://your-domain.com/api/" width="1" height="1" style="display:none;" />`;
    const personalizedBody = body
      .replace(/{{name}}/g, contact.name || 'Valued Customer')
      .replace(/{{userId}}/g, contact.userId || '');

    return personalizedBody + trackingPixel;
  };

  const buildPlainTextBody = (contact) => {
    return body
      .replace(/{{name}}/g, contact.name || 'Valued Customer')
      .replace(/{{userId}}/g, contact.userId || '')
      .replace(/<[^>]*>/g, ''); // Strip HTML tags for plain text
  };

  return (
    <div className="p-6 bg-white shadow rounded-lg">
      <h2 className="text-lg font-semibold mb-4">Send Email Campaign</h2>
      <div className="space-y-4">
        <select 
          value={selectedListId} 
          onChange={e => setSelectedListId(e.target.value)} 
          className="w-full border rounded px-3 py-2"
          disabled={loading}
        >
          <option value="">Select Email List</option>
          {lists.map(list => (
            <option key={list.id} value={list.id}>
              {list.listName} ({list.emails?.length || 0} contacts)
            </option>
          ))}
        </select>

        <select 
          value={selectedConfigId} 
          onChange={e => setSelectedConfigId(e.target.value)} 
          className="w-full border rounded px-3 py-2"
          disabled={loading}
        >
          <option value="">Select Email Provider</option>
          {configs.map(config => (
            <option key={config.id} value={config.id}>
              {config.name} ({config.provider})
            </option>
          ))}
        </select>

        <input
          type="text"
          placeholder="Email Subject (e.g., Hello {{name}})"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="w-full border rounded px-3 py-2"
          disabled={loading}
        />

        <textarea
          placeholder="Email Body (use {{name}}, {{userId}} for personalization)"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="w-full border rounded px-3 py-2 h-40"
          disabled={loading}
        />

        {showProgress && (
          <div className="bg-gray-100 p-4 rounded">
            <div className="flex justify-between text-sm text-gray-600 mb-2">
              <span>Progress: {progress.sent + progress.errors} / {progress.total}</span>
              <span>Success: {progress.sent} | Errors: {progress.errors}</span>
            </div>
            <div className="w-full bg-gray-300 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                style={{ width: `${((progress.sent + progress.errors) / progress.total) * 100}%` }}
              ></div>
            </div>
          </div>
        )}

        <button
          onClick={handleSendEmails}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:bg-gray-400"
          disabled={loading}
        >
          {loading ? `Sending... (${progress.sent + progress.errors}/${progress.total})` : "Send Emails"}
        </button>
      </div>
    </div>
  );
}