const BASE = "/api/post-gres-apis/salesforce/accounts";

const json = async (res) => {
  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText} :: ${msg}`);
  }
  return res.json();
};

const toCamel = (a) => ({
  accountId: a.id,
  name: a.name,
  type: a.type ?? null,
  website: a.website ?? null,
  phone: a.phone ?? null,
  raw: a.raw ?? a,
});

const SalesforceAccountModel = {
  async list({ limit = 50 } = {}) {
    const res = await fetch(`${BASE}?limit=${limit}`, { cache: "no-store" });
    const data = await json(res);
    console.log(data)

    const items = (data.items ?? []).map((a) => toCamel(a));
    return { total: data.total ?? items.length, items };
  },

  async get(accountId) {
    const res = await fetch(`${BASE}/${encodeURIComponent(accountId)}`, {
      cache: "no-store",
    });
    return json(res);
  },
  
};

export default SalesforceAccountModel;
