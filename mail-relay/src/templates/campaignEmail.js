// templates/campaignEmail.js
import { wrap } from "./base.js";

export default function tmplCampaignEmail(payload) {
  const {
    recipient_name = "there",
    survey_link = "#",
    html = "",
    tracking_token = "",
    from_name = "",
  } = payload;

  // ✅ If custom HTML is provided, add tracking pixel to it
  if (html) {
    const trackingPixel = tracking_token 
      ? `<img src="${process.env.TRACKING_BASE_URL || 'https://api.example.com'}/track/open/${tracking_token}.gif" width="1" height="1" style="display:none;" />`
      : '';
    
    // Add tracking pixel at the end of the HTML
    return html + trackingPixel;
  }

  // ✅ Default template with tracking
  const trackingPixel = tracking_token 
    ? `<img src="${process.env.TRACKING_BASE_URL || 'https://api.example.com'}/track/open/${tracking_token}.gif" width="1" height="1" style="display:none;" />`
    : '';

  return wrap(`
    <div style="max-width: 600px; margin: 0 auto;">
      <h2 style="color: #111827; margin-bottom: 16px;">
        We'd love your feedback!
      </h2>
      
      <p style="color: #374151; font-size: 16px; line-height: 1.6;">
        Hi ${recipient_name},
      </p>
      
      <p style="color: #374151; font-size: 16px; line-height: 1.6;">
        We're conducting a survey and your input is valuable to us. 
        It will only take a few minutes to complete.
      </p>
      
      <div style="text-align: center; margin: 32px 0;">
        <a href="${survey_link}" 
           style="display: inline-block; 
                  background-color: #3b82f6; 
                  color: white; 
                  padding: 14px 32px; 
                  text-decoration: none; 
                  border-radius: 6px;
                  font-weight: 600;
                  font-size: 16px;">
          Take Survey
        </a>
      </div>
      
      <p style="color: #6b7280; font-size: 14px;">
        Thank you for your time and feedback!
      </p>
      
      <hr style="margin: 24px 0; border: none; border-top: 1px solid #e5e7eb;">
      
      <p style="color: #9ca3af; font-size: 12px;">
        This email was sent as part of a survey campaign. 
        If you no longer wish to receive these emails, you can 
        <a href="${survey_link}&action=unsubscribe" style="color: #3b82f6; text-decoration: none;">
          unsubscribe here
        </a>.
      </p>
      
      ${trackingPixel}
    </div>
  `);
}