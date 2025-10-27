import { wrap } from "./base.js";

export default ({ org_id, calendar_id, name, timezone, active }) =>
  wrap(`
    <h2>New Business Calendar Added</h2>
    <ul>
      <li><b>Org:</b> ${org_id}</li>
      <li><b>Calendar ID:</b> ${calendar_id}</li>
      <li><b>Name:</b> ${name}</li>
      <li><b>Timezone:</b> ${timezone || "-"}</li>
      <li><b>Active:</b> ${String(active)}</li>
    </ul>
  `);
