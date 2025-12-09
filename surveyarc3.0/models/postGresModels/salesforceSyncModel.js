// models/postGresModels/salesforceSyncModel.js
const BASE = "/api/post-gres-apis/salesforce-campaigns";

const json = async (res) => {
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText} :: ${text}`);
  }
  return res.json();
};

const SalesforceSyncModel = {
  /**
   * Sync a Salesforce Account as a new/updated Contact List.
   * Backend creates/updates ContactList and adds all contacts.
   */
  async syncAccountAsList(accountId, orgId) {
    const res = await fetch(`${BASE}/sync-account-as-list`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountId, orgId }),
      cache: "no-store",
    });
    return json(res); // returns summary from backend
  },

  /**
   * Add Salesforce contacts into an EXISTING contact list.
   * You can pass either a Salesforce account ID OR explicit contact IDs.
   */
  async addToExistingList({ listId, salesforceAccountId, salesforceContactIds }) {
    const res = await fetch(`${BASE}/add-to-list`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        listId,
        salesforceAccountId: salesforceAccountId ?? null,
        salesforceContactIds: salesforceContactIds ?? null,
      }),
      cache: "no-store",
    });
    return json(res);
  },

  /** Get high-level sync stats (how many contacts have salesforce_id, etc.) */
  async getSyncStatus() {
    const res = await fetch(`${BASE}/sync-status`, {
      cache: "no-store",
    });
    return json(res);
  },
};

export default SalesforceSyncModel;
