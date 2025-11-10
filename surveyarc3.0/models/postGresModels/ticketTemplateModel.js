// models/postGresModels/ticketTemplateModel.js

const BASE = "/api/post-gres-apis/ticket-templates";

const json = async (res) => {
  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText} :: ${msg}`);
  }
  return res.json();
};

const toCamel = (t) => ({
  templateId: t.template_id,
  userId:t.user_id,
  orgId: t.org_id,
  name: t.name,
  description: t.description,
  apiKey: t.api_key,
  isActive: t.is_active,
  subjectTemplate: t.subject_template,
  descriptionTemplate: t.description_template,
  defaultStatus: t.default_status,
  defaultPriority: t.default_priority,
  defaultSeverity: t.default_severity,
  defaultAssigneeId: t.default_assignee_id,
  defaultTeamId: t.default_team_id,
  defaultGroupId: t.default_group_id,
  defaultCategoryId: t.default_category_id,
  defaultSubcategoryId: t.default_subcategory_id,
  defaultFeatureId: t.default_feature_id,
  defaultImpactId: t.default_impact_id,
  defaultSlaId: t.default_sla_id,
  defaultTagIds: t.default_tag_ids || [],
  defaultCustomFields: t.default_custom_fields || {},
  allowedVariables: t.allowed_variables || [],
  validationRules: t.validation_rules || {},
  meta: t.meta_data || t.meta || {},
  usageCount: t.usage_count,
  lastUsedAt: t.last_used_at,
  createdBy: t.created_by,
  createdAt: t.created_at,
  updatedAt: t.updated_at,
});

const toSnake = (data) => ({
  user_id: data.userId,
  org_id: data.org_id,
  name: data.name,
  description: data.description,
  subject_template: data.subjectTemplate,
  description_template: data.descriptionTemplate,
  default_status: data.defaultStatus,
  default_priority: data.defaultPriority,
  default_severity: data.defaultSeverity,
  default_assignee_id: data.defaultAssigneeId,
  default_team_id: data.defaultTeamId,
  default_group_id: data.defaultGroupId,
  default_category_id: data.defaultCategoryId,
  default_subcategory_id: data.defaultSubcategoryId,
  default_feature_id: data.defaultFeatureId,
  default_impact_id: data.defaultImpactId,
  default_sla_id: data.defaultSlaId,
  default_tag_ids: data.defaultTagIds || [],
  default_custom_fields: data.defaultCustomFields || {},
  allowed_variables: data.allowedVariables || [],
  validation_rules: data.validationRules || {},
  is_active: data.isActive,
  meta: data.meta || {},
});

const TicketTemplateModel = {
  /**
   * Create a new ticket template
   * @param {Object} data - Template data in camelCase
   * @returns {Promise<Object>} Created template with API key
   */
async create(data) {
console.log(data)

  const body = toSnake(data);
console.log(body)
  const res = await fetch(`${BASE}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-User-Id": data.user_id,   // ✅ Important
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  return toCamel(await json(res));
}
,
  /**
   * Get all templates for an organization
   * @param {string} orgId - Organization ID
   * @returns {Promise<Array>} Array of templates
   */
async getAllByOrg(orgId, userId) {
  const res = await fetch(`${BASE}?org_id=${encodeURIComponent(orgId)}&user_id=${encodeURIComponent(userId)}`, { 
    cache: "no-store"
  });
    const arr = await json(res);
    return (arr || []).map(toCamel);
  },

  /**
   * Get a single template by ID
   * @param {string} templateId - Template ID
   * @returns {Promise<Object>} Template object
   */
  async get(templateId) {
    const res = await fetch(`${BASE}/${encodeURIComponent(templateId)}`, { 
      cache: "no-store" 
    });
    return toCamel(await json(res));
  },

  /**
   * Update a template
   * @param {string} templateId - Template ID
   * @param {Object} data - Update data in camelCase
   * @returns {Promise<Object>} Updated template
   */
  async update(templateId, data) {
    const body = toSnake(data);
    const res = await fetch(`${BASE}/${encodeURIComponent(templateId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    return toCamel(await json(res));
  },

  /**
   * Delete a template
   * @param {string} templateId - Template ID
   * @returns {Promise<Object>} Deletion response
   */
  async delete(templateId,orgId,userId) {
    const res = await fetch(`${BASE}/${encodeURIComponent(templateId)}?org_id=${encodeURIComponent(orgId)}&user_id=${encodeURIComponent(userId)}`, {
      method: "DELETE",
      cache: "no-store",
    });
    return json(res);
  },

  /**
   * Deactivate a template (soft delete)
   * @param {string} templateId - Template ID
   * @returns {Promise<Object>} Updated template
   */
  async deactivate(templateId) {
    return this.update(templateId, { isActive: false });
  },

  /**
   * Activate a template
   * @param {string} templateId - Template ID
   * @returns {Promise<Object>} Updated template
   */
  async activate(templateId) {
    return this.update(templateId, { isActive: true });
  },

  /**
   * Get template usage statistics
   * @param {string} templateId - Template ID
   * @returns {Promise<Object>} Usage stats
   */
  async getStats(templateId) {
    const res = await fetch(`${BASE}/${encodeURIComponent(templateId)}/stats`, { 
      cache: "no-store" 
    });
    const data = await json(res);
    return {
      templateId: data.template_id,
      name: data.name,
      usageCount: data.usage_count,
      lastUsedAt: data.last_used_at,
      isActive: data.is_active,
    };
  },

  /**
   * Create a ticket from a template using API key
   * @param {string} apiKey - Template API key
   * @param {Object} ticketData - Ticket creation data
   * @param {string} ticketData.requesterId - User requesting the ticket
   * @param {Object} ticketData.variables - Variables to substitute in template
   * @param {Object} ticketData.overrides - Override template defaults
   * @returns {Promise<Object>} Created ticket
   */
  async createTicket(apiKey, ticketData) {
    const body = {
      requester_id: ticketData.requesterId,
      variables: ticketData.variables || {},
      overrides: ticketData.overrides || {},
    };
    
    const res = await fetch(`${BASE}/create-ticket`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "X-API-Key": apiKey,
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    
    const data = await json(res);
    return {
      ticketId: data.ticket_id,
      number: data.number,
      subject: data.subject,
      status: data.status,
      priority: data.priority,
      createdAt: data.created_at,
    };
  },

  /**
   * Regenerate API key for a template
   * @param {string} templateId - Template ID
   * @returns {Promise<Object>} New API key
   */
  async regenerateApiKey(templateId) {
    const res = await fetch(`${BASE}/${encodeURIComponent(templateId)}/regenerate-key`, {
      method: "POST",
      cache: "no-store",
    });
    return json(res);
  },
};

export default TicketTemplateModel;