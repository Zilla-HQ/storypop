/**
 * Partner outreach email templates. These are sent from
 * partners@<sender_domain> by the /admin/partner-outreach UI to web
 * designers, SEO freelancers, and marketing consultants — pitching
 * Sitebeat as a recommended-tool / affiliate opportunity.
 *
 * Two variants:
 *   - `initial`: cold first-touch email
 *   - `followup`: 5-day no-reply follow-up
 *
 * Both stay under 150 words because cold-outreach data shows shorter
 * is better at this stage.
 */

export interface PitchVariables {
  recipientName?: string | null;
  // Pre-generated personal-touch hook, e.g. "I noticed you list
  // WordPress development on your site — Sitebeat ships a free WP
  // plugin." Optional.
  hook?: string | null;
}

export function initialPitchSubject(_v: PitchVariables): string {
  return "30% lifetime kickback if Sitebeat is a fit for your clients";
}

export function initialPitchText(v: PitchVariables): string {
  const greeting = v.recipientName ? `Hi ${v.recipientName},` : "Hi,";
  return `${greeting}

I'm Jack, the founder of Sitebeat (sitebeat.tech) — a $29/mo SEO monitor that emails site owners only when something on their site regresses. Built specifically for the agency / freelance use case where you need a low-friction post-engagement monitoring layer for client sites.

${v.hook ? v.hook + "\n\n" : ""}We pay 30% lifetime commission. Reasonable scenario: 20 client sites recommending Sitebeat = $174/mo recurring. No cap, no period limit.

Reply if you'd like a ref code — takes 24 hours to set up, no minimums.

Or check out the partner program directly: https://sitebeat.tech/partners

Worth a look?

— Jack
`;
}

export function initialPitchMjml(v: PitchVariables): string {
  const greeting = v.recipientName ? `Hi ${escapeHtml(v.recipientName)},` : "Hi,";
  const hookLine = v.hook
    ? `<mj-text font-size="14px" color="#0f172a" line-height="1.55">${escapeHtml(v.hook)}</mj-text>`
    : "";

  return `
<mjml>
  <mj-body background-color="#ffffff">
    <mj-section padding="32px 24px 16px">
      <mj-column>
        <mj-text font-size="14px" color="#0f172a" line-height="1.55">
          ${greeting}
        </mj-text>
        <mj-text font-size="14px" color="#0f172a" line-height="1.55">
          I'm Jack, the founder of <a href="https://sitebeat.tech?utm_source=partner_outreach" style="color:#047857;text-decoration:underline;">Sitebeat</a> — a $29/mo SEO monitor that emails site owners only when something on their site regresses. Built specifically for the agency / freelance use case where you need a low-friction post-engagement monitoring layer for client sites.
        </mj-text>
        ${hookLine}
        <mj-text font-size="14px" color="#0f172a" line-height="1.55">
          We pay 30% lifetime commission. Reasonable scenario: 20 client sites recommending Sitebeat = $174/mo recurring. No cap, no period limit.
        </mj-text>
        <mj-text font-size="14px" color="#0f172a" line-height="1.55">
          Reply if you'd like a ref code — takes 24 hours to set up, no minimums.
        </mj-text>
        <mj-text font-size="14px" color="#0f172a" line-height="1.55">
          Or check out the partner program directly: <a href="https://sitebeat.tech/partners?utm_source=partner_outreach" style="color:#047857;text-decoration:underline;">sitebeat.tech/partners</a>
        </mj-text>
        <mj-text font-size="14px" color="#0f172a" line-height="1.55">
          Worth a look?
        </mj-text>
        <mj-text font-size="14px" color="#0f172a" line-height="1.55">
          — Jack
        </mj-text>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>`;
}

export function followupPitchSubject(_v: PitchVariables): string {
  return "Re: 30% lifetime kickback if Sitebeat is a fit for your clients";
}

export function followupPitchText(v: PitchVariables): string {
  const greeting = v.recipientName ? `Hi ${v.recipientName},` : "Hi again,";
  return `${greeting}

Following up on my note from last week about Sitebeat's partner program.

The short version: $29/mo SEO monitor for client sites, 30% lifetime commission to the partner who recommended it. No setup cost, no minimums, you keep earning as long as the customer keeps paying.

If it's not a fit, no worries — feel free to reply STOP and I won't email again.

If you want to check it out: https://sitebeat.tech/partners

— Jack
`;
}

export function followupPitchMjml(v: PitchVariables): string {
  const greeting = v.recipientName ? `Hi ${escapeHtml(v.recipientName)},` : "Hi again,";
  return `
<mjml>
  <mj-body background-color="#ffffff">
    <mj-section padding="32px 24px 16px">
      <mj-column>
        <mj-text font-size="14px" color="#0f172a" line-height="1.55">
          ${greeting}
        </mj-text>
        <mj-text font-size="14px" color="#0f172a" line-height="1.55">
          Following up on my note from last week about <a href="https://sitebeat.tech?utm_source=partner_outreach" style="color:#047857;text-decoration:underline;">Sitebeat</a>'s partner program.
        </mj-text>
        <mj-text font-size="14px" color="#0f172a" line-height="1.55">
          The short version: $29/mo SEO monitor for client sites, 30% lifetime commission to the partner who recommended it. No setup cost, no minimums, you keep earning as long as the customer keeps paying.
        </mj-text>
        <mj-text font-size="14px" color="#0f172a" line-height="1.55">
          If it's not a fit, no worries — feel free to reply STOP and I won't email again.
        </mj-text>
        <mj-text font-size="14px" color="#0f172a" line-height="1.55">
          If you want to check it out: <a href="https://sitebeat.tech/partners?utm_source=partner_outreach" style="color:#047857;text-decoration:underline;">sitebeat.tech/partners</a>
        </mj-text>
        <mj-text font-size="14px" color="#0f172a" line-height="1.55">
          — Jack
        </mj-text>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
