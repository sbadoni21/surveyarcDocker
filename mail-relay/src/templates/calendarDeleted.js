import { wrap } from "./base.js";

export default ({ org_id, calendar_id, name }) =>
  wrap(`
    <h2>Business Calendar Deleted</h2>
    <p>The following business calendar has been removed:</p>
    <ul>
      <li><b>Organization:</b> ${org_id}</li>
      <li><b>Calendar ID:</b> ${calendar_id}</li>
      <li><b>Name:</b> ${name}</li>
    </ul>
  `);
