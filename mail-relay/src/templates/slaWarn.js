import { wrap } from "./base.js";
export default ({ ticket_id, dimension, fraction, target_minutes, due_at }) =>
  wrap(`
  <p>Heads up — Ticket <b>${ticket_id}</b> is at <b>${Math.round((fraction||0)*100)}%</b> of the <b>${dimension}</b> target.</p>
  <ul>
    <li><b>Target minutes:</b> ${target_minutes}</li>
    <li><b>Due at:</b> ${due_at || "-"}</li>
  </ul>
`);
