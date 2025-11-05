export /** ✅ Normalizer */
const normalizeRow = (row) => {
  const name =
    row.Name ??
    row.name ??
    row.FullName ??
    row["Full Name"] ??
    row.NAME ??
    "";

  const email =
    row.Email ??
    row.email ??
    row["E-mail"] ??
    row.EMAIL ??
    "";

  const phone =
    row.Phone ??
    row.phone ??
    row["Phone Number"] ??
    row.Mobile ??
    "";

  const platform =
    row.Platform ??
    row.platform ??
    row["Social Platform"] ??
    "";

  const handle =
    row.Handle ??
    row.handle ??
    row["Social Handle"] ??
    row.Username ??
    "";

  const link =
    row.Link ??
    row.link ??
    row.URL ??
    row["Profile URL"] ??
    "";

  return {
    raw: row,
    name: String(name).trim(),
    email: String(email).trim(),
    phone: String(phone).trim(),
    platform: String(platform).trim(),
    handle: String(handle).trim(),
    link: String(link).trim(),
  };
};

