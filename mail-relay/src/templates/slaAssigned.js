import { wrap } from "./base.js";
export default ({ ticket_id, org_id, sla_id, first_response_due_at, resolution_due_at }) =>
  wrap(`
  <p>An SLA has been assigned to ticket <b>${ticket_id}</b>.</p>
  <ul>
    <li><b>Org:</b> ${org_id}</li>
    <li><b>SLA:</b> ${sla_id}</li>
    <li><b>First Response Due:</b> ${first_response_due_at || "-"}</li>
    <li><b>Resolution Due:</b> ${resolution_due_at || "-"}</li>
  </ul>
`);
