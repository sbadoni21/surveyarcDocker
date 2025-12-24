// models/postGresModels/campaignModel.js

const BASE = "/api/post-gres-apis/campaigns";

const json = async (res) => {
  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText} :: ${msg}`);
  }
  return res.json();
};

const toCamel = (c) => ({
  campaignId: c.campaign_id,
  orgId: c.org_id,
  userId: c.user_id,
  campaignName: c.campaign_name,
  surveyId: c.survey_id,
  
  channel: c.channel,
  fallbackChannel: c.fallback_channel,
  channelPriority: c.channel_priority || [],
  
  // ✅ B2B vs B2C
  contactListId: c.contact_list_id,
  audienceFileId: c.audience_file_id,  // ✅ NEW: B2C support
  contactFilters: c.contact_filters || {},
  
  emailSubject: c.email_subject,
  emailBodyHtml: c.email_body_html,
  emailFromName: c.email_from_name,
  emailReplyTo: c.email_reply_to,
  
  smsMessage: c.sms_message,
  whatsappMessage: c.whatsapp_message,
  whatsappTemplateId: c.whatsapp_template_id,
  voiceScript: c.voice_script,
  
  status: c.status,
  scheduledAt: c.scheduled_at,
  startedAt: c.started_at,
  completedAt: c.completed_at,
  
  totalRecipients: c.total_recipients,
  sentCount: c.sent_count,
  deliveredCount: c.delivered_count,
  failedCount: c.failed_count,
  bouncedCount: c.bounced_count,
  openedCount: c.opened_count,
  clickedCount: c.clicked_count,
  repliedCount: c.replied_count,
  unsubscribedCount: c.unsubscribed_count,
  surveyStartedCount: c.survey_started_count,
  surveyCompletedCount: c.survey_completed_count,
  channelStats: c.channel_stats || {},
  metaData: c.meta_data || {},
  
  createdAt: c.created_at,
  updatedAt: c.updated_at,
  deletedAt: c.deleted_at,
});

const toSnake = (c) => ({
  campaign_name: c.campaignName,
  survey_id: c.surveyId,
  channel: c.channel,
  org_id: c.orgId,
  user_id: c.userId,

  fallback_channel: c.fallbackChannel,
  channel_priority: c.channelPriority,
  
  // ✅ B2B vs B2C
  contact_list_id: c.contactListId,
  audience_file_id: c.audienceFileId,  // ✅ NEW: B2C support
  contact_filters: c.contactFilters,
  
  email_subject: c.emailSubject,
  email_body_html: c.emailBodyHtml,
  email_from_name: c.emailFromName,
  email_reply_to: c.emailReplyTo,
  
  sms_message: c.smsMessage,
  whatsapp_message: c.whatsappMessage,
  whatsapp_template_id: c.whatsappTemplateId,
  voice_script: c.voiceScript,
  
  scheduled_at: c.scheduledAt,
  status: c.status,
  meta_data: c.metaData,
});

const CampaignModel = {
  /** CREATE */
  async create(data, userId) {
    console.log("📝 Creating campaign:", data);
    const body = toSnake(data);
    console.log("📤 Sending to backend:", body);

    const res = await fetch(`${BASE}?user_id=${userId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-User-Id": userId,
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    
    const result = await json(res);
    console.log("✅ Campaign created:", result);
    return toCamel(result);
  },

  /** LIST */
  async getAll(params, userId) {
    const {
      page = 1,
      pageSize = 20,
      status,
      channel,
      surveyId,
      search,
    } = params;
    
    const queryParams = new URLSearchParams();
    queryParams.append("page", page);
    queryParams.append("page_size", pageSize);
    queryParams.append("user_id", userId);
    
    if (status && Array.isArray(status)) {
      status.forEach(s => queryParams.append("status", s));
    }
    if (channel && Array.isArray(channel)) {
      channel.forEach(c => queryParams.append("channel", c));
    }
    if (surveyId) queryParams.append("survey_id", surveyId);
    if (search) queryParams.append("search", search);
    
    const res = await fetch(`${BASE}?${queryParams.toString()}`, {
      cache: "no-store",
    });
    
    const data = await json(res);
    
    return {
      items: (data.items || []).map(toCamel),
      total: data.total,
      page: data.page,
      pageSize: data.page_size,
      totalPages: data.total_pages,
    };
  },

  /** GET BY ID */
  async get(campaignId, userId) {
    const res = await fetch(
      `${BASE}/${encodeURIComponent(campaignId)}?user_id=${encodeURIComponent(userId)}`,
      {
        cache: "no-store",
      }
    );
    
    return toCamel(await json(res));
  },

  /** UPDATE */
  async update(campaignId, data, userId) {
    const body = toSnake(data);
    
    const res = await fetch(`${BASE}/${encodeURIComponent(campaignId)}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "X-User-Id": userId,
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    
    return toCamel(await json(res));
  },

  /** DELETE */
  async delete(campaignId, userId) {
    const res = await fetch(
      `${BASE}/${encodeURIComponent(campaignId)}?user_id=${encodeURIComponent(userId)}`,
      {
        method: "DELETE",
        cache: "no-store",
      }
    );
    
    if (res.status === 204) return { success: true };
    return json(res);
  },

  /** SEND */
  async send(campaignId, sendData, userId) {
    console.log("🚀 Sending campaign:", campaignId, sendData);
    
    const res = await fetch(
      `${BASE}/${encodeURIComponent(campaignId)}/send`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": userId,
        },
        body: JSON.stringify(sendData),
        cache: "no-store",
      }
    );
    
    const result = await json(res);
    console.log("✅ Campaign send response:", result);
    return result;
  },

  /** PAUSE */
  async pause(campaignId, userId) {
    const res = await fetch(
      `${BASE}/${encodeURIComponent(campaignId)}/pause?user_id=${encodeURIComponent(userId)}`,
      {
        method: "POST",
        cache: "no-store",
      }
    );
    
    return json(res);
  },

  /** RESUME */
  async resume(campaignId, userId) {
    const res = await fetch(
      `${BASE}/${encodeURIComponent(campaignId)}/resume?user_id=${encodeURIComponent(userId)}`,
      {
        method: "POST",
        cache: "no-store",
      }
    );
    
    return json(res);
  },

  /** GET ANALYTICS */
  async getAnalytics(campaignId, userId) {
    const res = await fetch(
      `${BASE}/${encodeURIComponent(campaignId)}/analytics?user_id=${encodeURIComponent(userId)}`,
      {
        cache: "no-store",
      }
    );
    
    return json(res);
  },

  /** GET RESULTS (B2B only) */
  async getResults(campaignId, params, userId) {
    const {
      page = 1,
      pageSize = 50,
      status,
      channel,
    } = params;
    
    const queryParams = new URLSearchParams();
    queryParams.append("page", page);
    queryParams.append("page_size", pageSize);
    queryParams.append("user_id", userId);
    
    if (status && Array.isArray(status)) {
      status.forEach(s => queryParams.append("status", s));
    }
    if (channel && Array.isArray(channel)) {
      channel.forEach(c => queryParams.append("channel", c));
    }
    
    const res = await fetch(
      `${BASE}/${encodeURIComponent(campaignId)}/results?${queryParams.toString()}`,
      {
        cache: "no-store",
      }
    );
    
    const data = await json(res);
    return {
      items: data.items || [],
      total: data.total,
      page: data.page,
      pageSize: data.page_size,
      totalPages: data.total_pages,
    };
  },

  // ============================================
  // ✅ NEW: B2C METHODS
  // ============================================

  /** GET B2C STATS */
  async getB2CStats(campaignId, userId) {
    console.log("📊 Fetching B2C stats for campaign:", campaignId);
    
    const res = await fetch(
      `${BASE}/${encodeURIComponent(campaignId)}/b2c/stats?user_id=${encodeURIComponent(userId)}`,
      {
        cache: "no-store",
      }
    );
    
    const stats = await json(res);
    console.log("✅ B2C stats received:", stats);
    return stats;
  },

  /** DOWNLOAD B2C FILE */
  async downloadB2CFile(campaignId, userId) {
    console.log("📥 Downloading B2C file for campaign:", campaignId);
    
    const res = await fetch(
      `${BASE}/${encodeURIComponent(campaignId)}/b2c/file?user_id=${encodeURIComponent(userId)}`,
      {
        cache: "no-store",
      }
    );

    if (!res.ok) {
      throw new Error(`Failed to download file: ${res.statusText}`);
    }

    // Return blob for download
    const blob = await res.blob();
    const filename = res.headers.get('Content-Disposition')
      ?.split('filename=')[1]
      ?.replace(/"/g, '') || `campaign_${campaignId}_results.csv`;

    console.log("✅ B2C file downloaded:", filename);
    return { blob, filename };
  },

  /** UPLOAD AUDIENCE FILE (B2C) */
  async uploadAudienceFile(file, audienceName, orgId, userId) {
    console.log("📤 Uploading audience file:", {
      fileName: file.name,
      fileSize: file.size,
      audienceName,
      orgId
    });
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('audience_name', audienceName);
    formData.append('org_id', orgId);

    const res = await fetch('/api/post-gres-apis/audience-files/upload', {
      method: 'POST',
      headers: {
        'X-User-Id': userId,
      },
      body: formData,
      cache: 'no-store',
    });

    const result = await json(res);
    console.log("✅ Audience file uploaded:", result);
    return result;
  },
};

export default CampaignModel;