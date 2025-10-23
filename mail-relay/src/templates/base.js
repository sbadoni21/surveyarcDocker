export const wrap = (inner) =>`
  <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; line-height:1.5;">
    ${inner}
    <hr style="margin:24px 0;border:none;border-top:1px solid #e5e7eb;">
    <div style="font-size:12px;color:#6b7280;">
      Sent automatically by Support Desk • Please do not reply directly to this email
    </div>
  </div>
`;
