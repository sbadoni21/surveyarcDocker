// ✅ Pure validator utility
export const validateUploadedContacts = ({
  existingContacts = [],
  uploadedContacts = [],
  existingEmails = [],
  existingPhones = [],
  existingSocials = [],
}) => {
  const toCreate = [];
  const toUpdate = [];
  const toSkip = [];

  // ✅ Find match by primaryIdentifier
  const findMatch = (c) => {
    return existingContacts.find(
      (db) => db.primaryIdentifier === c.primaryIdentifier
    );
  };

  uploadedContacts.forEach((u) => {
    const db = findMatch(u);

    // ✅ CASE-3 — NEW contact → toCreate
    if (!db) {
      toCreate.push(u);
      return;
    }

    // ✅ CASE-1 / CASE-2 — Existing, check new data
    let needsUpdate = false;

    // ---------- EMAILS ----------
    const dbEmails = existingEmails.filter((e) => e.contactId === db.contactId);

    const newEmails = (u.emails ?? []).filter(
      (e) => !dbEmails.some((x) => x.email_lower === e.email.toLowerCase())
    );

    if (newEmails?.length) needsUpdate = true;

    // ---------- PHONES ----------
    const dbPhones = existingPhones.filter((p) => p.contactId === db.contactId);

    const newPhones = (u.phones ?? []).filter(
      (p) =>
        !dbPhones.some(
          (x) =>
            x.phone_number === p.phone_number &&
            x.country_code === p.country_code
        )
    );

    if (newPhones?.length) needsUpdate = true;

    // ---------- SOCIALS ----------
    const dbSocials = existingSocials.filter(
      (s) => s.contactId === db.contactId
    );

    const newSocials = (u.socials ?? []).filter(
      (s) => !dbSocials.some(
        (x) => x.platform === s.platform && x.handle === s.handle
      )
    );

    if (newSocials?.length) needsUpdate = true;

    // ✅ CASE-2 — Existing but new data → update
    if (needsUpdate) {
      toUpdate.push({ existing: db, newData: u });
      return;
    }

    // ✅ CASE-1 — Exact same → skip
    toSkip.push(db);
  });

  return {
    toCreate,
    toUpdate,
    toSkip,
  };
};
