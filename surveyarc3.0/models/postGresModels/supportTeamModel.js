// models/postGresModels/supportTeamModel.js
const BASE = "/api/post-gres-apis/support-teams";
const json = async (r) => (r.ok ? r.json() : Promise.reject(await r.text()));

// Team data conversion
const toCamel = (t) => ({
  teamId: t.team_id,
  orgId: t.org_id,
  groupId: t.group_id,
  name: t.name,
  description: t.description,
  email: t.email,
  targetProficiency: t.target_proficiency,
  routingWeight: t.routing_weight,
  defaultSlaId: t.default_sla_id,
  meta: t.meta || {},
  active: t.active !== false,
  createdAt: t.created_at,
  updatedAt: t.updated_at,
  calendarId: t.calendar_id,
});

// Team member data conversion
const memberToCamel = (m) => ({
  teamId: m.team_id,
  userId: m.user_id,
  role: m.role,
  proficiency: m.proficiency,
  active: m.active !== false,
  weeklyCapacityMinutes: m.weekly_capacity_minutes,
  createdAt: m.created_at,
  updatedAt: m.updated_at,
});

// Convert frontend data to API format
// supportTeamModel.utils.js

const omitNullish = (obj) => {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined && v !== null) out[k] = v;
  }
  return out;
};

// read from either camelCase or snake_case without guessing at call sites
const get = (obj, camel, snake) =>
  obj?.[camel] ?? obj?.[snake] ?? undefined;

export const toApiFormat = (data = {}) => {
  // Log once to confirm what we received
  // console.log("[toApiFormat] in:", JSON.stringify(data));

  const out = omitNullish({
    // team fields
    team_id:                get(data, "teamId", "team_id"),
    org_id:                 get(data, "orgId", "org_id"),
    group_id:               get(data, "groupId", "group_id"),
    name:                   get(data, "name", "name"),
    description:            get(data, "description", "description"),
    email:                  get(data, "email", "email"),
    target_proficiency:     get(data, "targetProficiency", "target_proficiency"),
    routing_weight:         get(data, "routingWeight", "routing_weight"),
    default_sla_id:         get(data, "defaultSlaId", "default_sla_id"),
    meta:                   get(data, "meta", "meta"),
    active:                 get(data, "active", "active"),
    calendar_id:            get(data, "calendarId", "calendar_id"),
    // member fields
    user_id:                get(data, "userId", "user_id"),
    role:                   get(data, "role", "role"),
    proficiency:            get(data, "proficiency", "proficiency"),
    weekly_capacity_minutes:get(data, "weeklyCapacityMinutes", "weekly_capacity_minutes"),
  });

  // console.log("[toApiFormat] out:", out);
  return out;
};

export const fromApiFormat = (row = {}) => ({
  teamId:                 get(row, "teamId", "team_id"),
  orgId:                  get(row, "orgId", "org_id"),
  groupId:                get(row, "groupId", "group_id"),
  name:                   get(row, "name", "name"),
  description:            get(row, "description", "description"),
  calendarId:            get(row, "calendarId", "calendar_id"),
  email:                  get(row, "email", "email"),
  targetProficiency:      get(row, "targetProficiency", "target_proficiency"),
  routingWeight:          get(row, "routingWeight", "routing_weight"),
  defaultSlaId:           get(row, "defaultSlaId", "default_sla_id"),
  meta:                   get(row, "meta", "meta") || {},
  active:                 get(row, "active", "active"),

  userId:                 get(row, "userId", "user_id"),
  role:                   get(row, "role", "role"),
  proficiency:            get(row, "proficiency", "proficiency"),
  weeklyCapacityMinutes:  get(row, "weeklyCapacityMinutes", "weekly_capacity_minutes"),
});

const SupportTeamModel = {
  // ============ Team CRUD Operations ============
  
  async list({ orgId, groupId } = {}) {
    const qs = new URLSearchParams();
    if (orgId) qs.set("org_id", orgId);
    if (groupId) qs.set("group_id", groupId);
    
    const r = await fetch(`${BASE}?${qs}`, { cache: "no-store" });
    const arr = await json(r);
    return Array.isArray(arr) ? arr.map(toCamel) : [];
  },

  async get(teamId) {
    if (!teamId) throw new Error("Team ID is required");
    const r = await fetch(`${BASE}/${encodeURIComponent(teamId)}`, { cache: "no-store" });
    return toCamel(await json(r));
  },

  async create(body) {
    if (!body.name || !body.orgId || !body.groupId) {
      throw new Error("Name, orgId, and groupId are required");
    }
    const payload = toApiFormat(body);
    const r = await fetch(BASE, { 
      method: "POST", 
      headers: { "Content-Type": "application/json" }, 
      body: JSON.stringify(payload) 
    });
    return toCamel(await json(r));
  },

  async update(teamId, patch) {
    if (!teamId) throw new Error("Team ID is required");
    
    const payload = toApiFormat(patch);
    const r = await fetch(`${BASE}/${encodeURIComponent(teamId)}`, { 
      method: "PATCH", 
      headers: { "Content-Type": "application/json" }, 
      body: JSON.stringify(payload) 
    });
    return toCamel(await json(r));
  },

  async remove(teamId) {
    if (!teamId) throw new Error("Team ID is required");
    
    const r = await fetch(`${BASE}/${encodeURIComponent(teamId)}`, { method: "DELETE" });
    if (!r.ok && r.status !== 204) throw new Error(await r.text());
    return true;
  },

  // ============ Member Operations ============

  async listMembers(teamId) {
    if (!teamId) throw new Error("Team ID is required");
    const r = await fetch(`${BASE}/${encodeURIComponent(teamId)}/members`, { cache: "no-store" });
    const members = await json(r);
    return Array.isArray(members) ? members.map(memberToCamel) : [];
  },

  async addMember(teamId, body) {
    if (!teamId) throw new Error("Team ID is required");
    if (!body.user_id) throw new Error("User ID is required");
    
    const payload = toApiFormat(body);
    const r = await fetch(`${BASE}/${encodeURIComponent(teamId)}/members`, { 
      method: "POST", 
      headers: { "Content-Type": "application/json" }, 
      body: JSON.stringify(payload) 
    });
    return memberToCamel(await json(r));
  },

  async updateMember(teamId, userId, patch) {
    if (!teamId) throw new Error("Team ID is required");
    if (!userId) throw new Error("User ID is required");
    
    const payload = toApiFormat(patch);
    const r = await fetch(`${BASE}/${encodeURIComponent(teamId)}/members/${encodeURIComponent(userId)}`, { 
      method: "PATCH", 
      headers: { "Content-Type": "application/json" }, 
      body: JSON.stringify(payload) 
    });
    return memberToCamel(await json(r));
  },

  async removeMember(teamId, userId) {
    if (!teamId) throw new Error("Team ID is required");
    if (!userId) throw new Error("User ID is required");
    
    const r = await fetch(`${BASE}/${encodeURIComponent(teamId)}/members/${encodeURIComponent(userId)}`, { 
      method: "DELETE" 
    });
    if (!r.ok && r.status !== 204) throw new Error(await r.text());
    return true;
  },

  // ============ Analytics & Stats ============

  async getStats(teamId) {
    if (!teamId) throw new Error("Team ID is required");
    
    const r = await fetch(`${BASE}/${encodeURIComponent(teamId)}/stats`, { cache: "no-store" });
    return json(r);
  },

  // ============ Utility Methods ============

  async getTeamsByGroup(groupId) {
    return this.list({ groupId });
  },

  async getTeamsByOrg(orgId) {
    return this.list({ orgId });
  },

  async getTeamWithMembers(teamId) {
    const [team, members] = await Promise.all([
      this.get(teamId),
      this.listMembers(teamId)
    ]);
    return { ...team, members };
  },

  async getTeamWithStats(teamId) {
    const [team, stats] = await Promise.all([
      this.get(teamId),
      this.getStats(teamId)
    ]);
    return { ...team, stats };
  },

  // ============ Bulk Operations ============

  async bulkUpdateTeams(updates) {
    const promises = updates.map(({ teamId, ...patch }) => 
      this.update(teamId, patch)
    );
    const results = await Promise.allSettled(promises);
    
    const successful = [];
    const failed = [];
    
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        successful.push(result.value);
      } else {
        failed.push({
          teamId: updates[index].teamId,
          error: result.reason?.message || 'Unknown error'
        });
      }
    });
    
    return { successful, failed };
  },

  async bulkAddMembers(teamId, members) {
    const promises = members.map(member => this.addMember(teamId, member));
    const results = await Promise.allSettled(promises);
    
    const successful = [];
    const failed = [];
    
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        successful.push(result.value);
      } else {
        failed.push({
          userId: members[index].userId,
          error: result.reason?.message || 'Unknown error'
        });
      }
    });
    
    return { successful, failed };
  },

  // ============ Search & Filter ============

  async searchTeams(query, { orgId, groupId } = {}) {
    const teams = await this.list({ orgId, groupId });
    if (!query) return teams;
    
    const searchTerm = query.toLowerCase();
    return teams.filter(team => 
      team.name.toLowerCase().includes(searchTerm) ||
      (team.description && team.description.toLowerCase().includes(searchTerm)) ||
      (team.email && team.email.toLowerCase().includes(searchTerm))
    );
  },

  async getTeamsByProficiency(proficiency, { orgId, groupId } = {}) {
    const teams = await this.list({ orgId, groupId });
    return teams.filter(team => team.targetProficiency === proficiency);
  },

  async getActiveTeams({ orgId, groupId } = {}) {
    const teams = await this.list({ orgId, groupId });
    return teams.filter(team => team.active);
  },

  // ============ Analytics Helpers ============

  async getOrgTeamStats(orgId) {
    const teams = await this.list({ orgId });
    const statsPromises = teams.map(team => this.getStats(team.teamId));
    const allStats = await Promise.allSettled(statsPromises);
    
    const successful = allStats
      .filter(result => result.status === 'fulfilled')
      .map(result => result.value);
    
    return {
      totalTeams: teams.length,
      activeTeams: teams.filter(t => t.active).length,
      totalMembers: successful.reduce((sum, stat) => sum + stat.total_members, 0),
      totalCapacity: successful.reduce((sum, stat) => sum + stat.total_weekly_capacity_minutes, 0),
      proficiencyBreakdown: successful.reduce((acc, stat) => {
        Object.entries(stat.proficiency_breakdown || {}).forEach(([level, count]) => {
          acc[level] = (acc[level] || 0) + count;
        });
        return acc;
      }, {}),
      roleBreakdown: successful.reduce((acc, stat) => {
        Object.entries(stat.role_breakdown || {}).forEach(([role, count]) => {
          acc[role] = (acc[role] || 0) + count;
        });
        return acc;
      }, {}),
    };
  },

  // ============ Validation Helpers ============

  validateTeamData(data) {
    const errors = [];
    
    if (!data.name?.trim()) errors.push("Team name is required");
    if (!data.orgId?.trim()) errors.push("Organization ID is required");
    if (!data.groupId?.trim()) errors.push("Group ID is required");
    if (data.routingWeight && (data.routingWeight < 1 || data.routingWeight > 100)) {
      errors.push("Routing weight must be between 1 and 100");
    }
    if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      errors.push("Invalid email format");
    }
    
    return { isValid: errors.length === 0, errors };
  },

  validateMemberData(data) {
    const errors = [];
    
    if (!data.userId?.trim()) errors.push("User ID is required");
    if (data.role && !['agent', 'lead', 'viewer'].includes(data.role)) {
      errors.push("Role must be 'agent', 'lead', or 'viewer'");
    }
    if (data.proficiency && !['l1', 'l2', 'l3', 'specialist'].includes(data.proficiency)) {
      errors.push("Proficiency must be 'l1', 'l2', 'l3', or 'specialist'");
    }
    if (data.weeklyCapacityMinutes && data.weeklyCapacityMinutes < 0) {
      errors.push("Weekly capacity cannot be negative");
    }
    
    return { isValid: errors.length === 0, errors };
  }
};

export default SupportTeamModel;