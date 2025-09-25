import ContactModel from "@/models/postGresModels/contactModel";
import ContactListModel from "@/models/postGresModels/contactListModel";

/**
 * contacts: [{ name, email, status? }]
 * Returns: created list object
 */
export async function upsertListWithContacts(orgId, listName, contacts) {
  // 1) upsert contacts by email (simple path: try create; if 409, fetch-all & find, else update)
  const existing = await ContactModel.getAll(orgId);
  const byEmail = new Map(existing.map(c => [c.email.toLowerCase(), c]));

  const ids = [];
  for (const c of contacts) {
    const key = (c.email || "").toLowerCase();
    if (!key) continue;
    if (byEmail.has(key)) {
      const exist = byEmail.get(key);
       await ContactModel.create(orgId, {
  name: c.name || "",
  email: c.email,                    // REQUIRED
  emailLower: c.email.toLowerCase(), // server can recompute, but ok to send
  status: "active",
  meta: {},
});
      ids.push(exist.contactId);
    } else {
      const created = await ContactModel.create(orgId, {
  name: c.name || "",
  email: c.email,                    // REQUIRED
  emailLower: c.email.toLowerCase(), // server can recompute, but ok to send
  status: "active",
  meta: {},
});
      ids.push(created.contactId);
      byEmail.set(key, created);
    }
  }

  // 2) create or update list
  const lists = await ContactListModel.getAll(orgId);
  const byName = new Map(lists.map(l => [l.name.toLowerCase(), l]));
  if (byName.has(listName.toLowerCase())) {
    const list = byName.get(listName.toLowerCase());
    const next = Array.from(new Set([...(list.contactIds || []), ...ids]));
    const updated = await ContactListModel.update(list.listId, { contactIds: next });
    return updated;
  } else {
    const created = await ContactListModel.create(orgId, { listName, contactIds: ids });
    return created;
  }
}
