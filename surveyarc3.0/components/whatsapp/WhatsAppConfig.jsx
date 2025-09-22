"use client";

import React, { useEffect, useState } from "react";
import { doc, getDoc, updateDoc, setDoc } from "firebase/firestore";
import { db } from "@/firebase/firebase";
import { useRouteParams } from "@/utils/getPaths";

export default function WhatsAppConfig() {
  const { orgId } = useRouteParams();
  const [saving, setSaving] = useState(false);
  const [conf, setConf] = useState({
    provider: "meta",
    businessAccountId: "",
    phoneNumberId: "",
    fromPhoneDisplay: "",
    permanentToken: "",
    webhookVerifyToken: "",
    webhookUrl: "",
    enabled: false,
  });

  useEffect(() => {
    (async () => {
      const orgRef = doc(db, "organizations", orgId);
      const snap = await getDoc(orgRef);
      if (snap.exists()) {
        const data = snap.data();
        const w = data.whatsappConfiguration || {};
        setConf(prev => ({ ...prev, ...w }));
      }
    })();
  }, [orgId]);

  const save = async () => {
    setSaving(true);
    try {
      const orgRef = doc(db, "organizations", orgId);
      const snap = await getDoc(orgRef);
      if (!snap.exists()) {
        await setDoc(orgRef, { whatsappConfiguration: conf });
      } else {
        await updateDoc(orgRef, { whatsappConfiguration: conf });
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 max-w-3xl">
      <h2 className="text-xl font-semibold mb-4">WhatsApp Business API Configuration</h2>

      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium">Provider</label>
          <select
            value={conf.provider}
            onChange={e => setConf({ ...conf, provider: e.target.value })}
            className="w-full border rounded px-3 py-2"
          >
            <option value="meta">Meta (Cloud API)</option>
            <option value="gupshup">Gupshup</option>
            <option value="twilio">Twilio</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium">Business Account ID</label>
          <input
            value={conf.businessAccountId}
            onChange={e => setConf({ ...conf, businessAccountId: e.target.value })}
            placeholder="eg. 1234567890"
            className="w-full border rounded px-3 py-2"
          />
        </div>

        <div>
          <label className="block text-sm font-medium">Phone Number ID</label>
          <input
            value={conf.phoneNumberId}
            onChange={e => setConf({ ...conf, phoneNumberId: e.target.value })}
            placeholder="eg. 112233445566778"
            className="w-full border rounded px-3 py-2"
          />
        </div>

        <div>
          <label className="block text-sm font-medium">From Phone (display)</label>
          <input
            value={conf.fromPhoneDisplay}
            onChange={e => setConf({ ...conf, fromPhoneDisplay: e.target.value })}
            placeholder="+91 98765 43210"
            className="w-full border rounded px-3 py-2"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium">Permanent Access Token</label>
          <input
            value={conf.permanentToken}
            onChange={e => setConf({ ...conf, permanentToken: e.target.value })}
            placeholder="EAAB... (store securely)"
            className="w-full border rounded px-3 py-2"
            type="password"
          />
        </div>

        <div>
          <label className="block text-sm font-medium">Webhook Verify Token</label>
          <input
            value={conf.webhookVerifyToken}
            onChange={e => setConf({ ...conf, webhookVerifyToken: e.target.value })}
            placeholder="YourVerifyToken"
            className="w-full border rounded px-3 py-2"
          />
        </div>

        <div>
          <label className="block text-sm font-medium">Webhook URL</label>
          <input
            value={conf.webhookUrl}
            onChange={e => setConf({ ...conf, webhookUrl: e.target.value })}
            placeholder="https://your.cloudfunctions.net/whatsappWebhook"
            className="w-full border rounded px-3 py-2"
          />
        </div>

        <div className="flex items-center gap-3 mt-2 md:col-span-2">
          <input
            id="enabled"
            type="checkbox"
            checked={conf.enabled}
            onChange={e => setConf({ ...conf, enabled: e.target.checked })}
          />
          <label htmlFor="enabled" className="text-sm">Enable this configuration</label>
        </div>
      </div>

      <div className="mt-6 flex justify-end gap-3">
        <button onClick={save} className="px-4 py-2 bg-blue-600 text-white rounded">
          {saving ? "Saving..." : "Save"}
        </button>
      </div>
    </div>
  );
}
