/**
 * Multi-touch follow-up email templates for the cold-outreach pipeline.
 *
 * Stage definitions (days since the audit-report email went out):
 *   - DAY2:  soft nudge — "did you see your audit?"
 *   - DAY5:  discount offer — 50% off first month via shared FIRST50 code
 *   - DAY10: break-up — final touch, polite "won't email again"
 *
 * Body kept short and personal. Subject reuses the original "X got a B+"
 * pattern so the message threads back into the same email conversation
 * the lead already has open in their inbox.
 */

export type FollowupStage = "day2" | "day5" | "day10";

export interface FollowupVars {
  domain: string; // e.g. "drqckbks.com"
  letterGrade: string; // "B+", "C", "F"
  score: number; // 0-100
  failingCount: number;
  warningCount: number;
  auditUrl: string; // https://sitebeat.tech/audit/<id>
  promoCode?: string; // "FIRST50" — passed on every stage; templates decide when to show
}

export const FOLLOWUP_TAG: Record<FollowupStage, string> = {
  day2: "audit_followup_day2",
  day5: "audit_followup_day5",
  day10: "audit_followup_day10",
};

export function followupSubject(_stage: FollowupStage, v: FollowupVars): string {
  // Re-use the original audit-report subject so the message threads
  // into the same Gmail/Outlook conversation as the first email.
  return `Re: ${v.domain} got a ${v.letterGrade} — ${v.failingCount + v.warningCount} SEO issues to fix`;
}

export function followupText(stage: FollowupStage, v: FollowupVars): string {
  switch (stage) {
    case "day2":
      return `Hi,

Quick follow-up — did you get a chance to look at the SEO audit I sent for ${v.domain}?

The headline: ${v.score}/100 (grade ${v.letterGrade}), with ${v.failingCount} failing and ${v.warningCount} warning. Each failed check is roughly one quiet drag on your search ranking — most are 30-second fixes once you know what to look for.

Full report (one-screen, forwardable to your developer):
${v.auditUrl}

Sitebeat re-checks the site every Monday and emails you only when something regresses. The first 14 days are free — no charge today, cancel before day 15 if it's not for you.

Start your free trial:
${v.auditUrl}

— Sitebeat`;

    case "day5":
      return `Hi,

I made this risk-free: the first 14 days are free. No charge today, no commitment, cancel before day 15 if monitoring doesn't pull its weight.

Your ${v.domain} audit (${v.score}/100, ${v.failingCount} failing checks) has been sitting in your inbox for a few days. The fix-and-monitor angle: get the issues fixed, Sitebeat watches for regressions every Monday, you don't think about SEO again unless your developer breaks something. After the trial, $29/mo.

Start free trial in 30 seconds:
${v.auditUrl}

— Sitebeat`;

    case "day10":
      return `Hi,

Last note from me on this. I won't keep emailing if it's not a fit.

Your ${v.domain} audit (${v.score}/100, ${v.failingCount} failing) is yours to keep — that report has every issue with fix instructions you can hand to your developer. No subscription needed to use it.

If you ever want weekly automated monitoring (catches SEO regressions the same week your dev introduces them), the first 14 days are free — no charge today, $29/mo after if you keep it:
${v.auditUrl}

Otherwise, no worries — replying STOP keeps you off the list permanently.

— Sitebeat`;
  }
}

export function followupMjml(stage: FollowupStage, v: FollowupVars): string {
  const text = followupText(stage, v);
  const paragraphs = text
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
  return `
<mjml>
  <mj-body background-color="#ffffff">
    <mj-section padding="32px 24px 16px">
      <mj-column>
        ${paragraphs
          .map(
            (p) =>
              `<mj-text font-size="14px" color="#0f172a" line-height="1.55">${p
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/\n/g, "<br/>")}</mj-text>`,
          )
          .join("\n        ")}
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>`;
}
