import { wrap } from "./base.js";
export default ({ ticket_id, dimension, org_id, sla_id, due_at }) =>
  wrap(`
  <p><b>SLA Breach</b> on ticket <b>${ticket_id}</b> for <b>${dimension}</b>.</p>
  <ul>
    <li><b>Due at:</b> ${due_at || "-"}</li>
    <li><b>Org:</b> ${org_id}</li>
    <li><b>SLA:</b> ${sla_id}</li>
  </ul>
`);
