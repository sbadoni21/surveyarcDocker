
const BASE = "/api/post-gres-apis/campaign-results";

const json = async (res) => {
  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText} :: ${msg}`);
  }
  return res.json();
};

const toCamel = (r) => ({
  resultId: r.result_id,
  campaignId: r.campaign_id,
  orgId: r.org_id,
  projectId: r.project_id,
  contactId: r.contact_id,
  contactEmail: r.contact_email,
  contactPhone: r.contact_phone,
  status: r.status,
  channel: r.channel,
  messageId: r.message_id,
  error: r.error,
  errorCode: r.error_code,
  sentAt: r.sent_at,
  failedAt: r.failed_at,
  deliveredAt: r.delivered_at,
  openedAt: r.opened_at,
  clickedAt: r.clicked_at,
  metaData: r.meta_data || {},
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const CampaignResultModel = {
  async create(data) {
    const body = {
      campaign_id: data.campaignId,
      org_id: data.orgId,
      project_id: data.projectId,
      contact_id: data.contactId,
      contact_email: data.contactEmail,
      contact_phone: data.contactPhone,
      status: data.status,
      channel: data.channel,
      message_id: data.messageId,
      error: data.error,
      error_code: data.errorCode,
      meta_data: data.metaData || {},
    };
    const res = await fetch(`${BASE}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    return toCamel(await json(res));
  },

  async getAllByCampaign(campaignId) {
    const res = await fetch(`${BASE}?campaign_id=${encodeURIComponent(campaignId)}`, { cache: "no-store" });
    const arr = await json(res);
    return (arr || []).map(toCamel);
  },

  async get(resultId) {
    const res = await fetch(`${BASE}/${encodeURIComponent(resultId)}`, { cache: "no-store" });
    return toCamel(await json(res));
  },
  async getOrCreate(data) {
    const body = {
      campaign_id: data.campaignId,
      org_id: data.orgId,
      project_id: data.projectId,
      contact_id: data.contactId,
      contact_email: data.contactEmail,
      contact_phone: data.contactPhone,
      status: data.status,
      channel: data.channel,
      message_id: data.messageId,
      error: data.error,
      error_code: data.errorCode,
      meta_data: data.metaData || {},
    };
    const res = await fetch(`${BASE}/get-or-create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    return toCamel(await json(res));
  },
  async update(resultId, data) {
    const res = await fetch(`${BASE}/${encodeURIComponent(resultId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
      cache: "no-store",
    });
    return toCamel(await json(res));
  },
};

export default CampaignResultModel;