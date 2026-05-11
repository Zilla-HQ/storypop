/**
 * One-shot send to the 2 warm leads who ran the grader and left an
 * email but haven't converted: rcuddy9 (Syracuse condo) and kychick24
 * (Red River Gorge cabin). FLASH50 50%-off offer, expires today 6pm
 * ET. Sent from the Restay brand address, not Jack personally.
 */
import { Resend } from "resend";
import { env } from "@/lib/env";

const RESEND_KEY = env("RESEND_API_KEY");
if (!RESEND_KEY) { console.error("no RESEND_API_KEY"); process.exit(1); }
const resend = new Resend(RESEND_KEY);
const FROM_DOMAIN = (env("SENDER_DOMAINS", "mail.restay.agency") ?? "mail.restay.agency").split(",")[0];
const FROM = `Restay <hello@${FROM_DOMAIN}>`;
const REPLY_TO = env("REPLIES_EMAIL", `jack@${FROM_DOMAIN}`)!;

interface Lead {
  email: string;
  airbnbUrl: string;
  hook: string;
  body: string;
  subject: string;
}

const leads: Lead[] = [
  {
    email: "rcuddy9@gmail.com",
    airbnbUrl: "https://www.airbnb.com/rooms/893589086138370542",
    subject: "Your Syracuse condo grade — 50% off the Tune-Up",
    hook: "We saw you ran the Restay grader on your Stylish 2-Bedroom Condo in Syracuse (Armory Square) last night.",
    body: "Brand-new listing as a Superhost — the first 30 days set the trajectory for the whole booking ramp, so getting the title + photos right early matters more than at almost any other point in a listing's life.",
  },
  {
    email: "kychick24@yahoo.com",
    airbnbUrl: "https://www.airbnb.com/rooms/1630185157666210900",
    subject: "Your Red River Gorge cabin grade — 50% off the Tune-Up",
    hook: "We saw you ran the Restay grader on Candlelight Cabin (the hot-tub cabin near Miguel's) yesterday.",
    body: "7 reviews at 5.0★ puts you right on the edge of Superhost, and getting the listing dialed before peak Gorge season ramps is the highest-leverage move you can make this month.",
  },
];

function buildLink(airbnbUrl: string): string {
  return `https://restay.agency/?promo=FLASH50&paste=${encodeURIComponent(airbnbUrl)}#paste`;
}

function textBody(l: Lead): string {
  const link = buildLink(l.airbnbUrl);
  return `${l.hook}

${l.body}

Restay's running a launch flash today: 50% off the full Listing Tune-Up — $39 instead of $79 — for the first 10 hosts. Code FLASH50, expires today at 6pm ET.

One-click claim, code auto-applies at checkout:
${link}

What's included: rewritten title + description, 10 restyled photos, 30-day pricing report. 14-day refund window, no subscription.

Reply to this email with any questions.

— Restay
restay.agency`;
}

function htmlBody(l: Lead): string {
  const link = buildLink(l.airbnbUrl);
  return `<!DOCTYPE html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;color:#0f172a;max-width:560px;margin:0 auto;padding:24px;">
<p>${l.hook}</p>
<p>${l.body}</p>
<p>Restay's running a launch flash today: <strong>50% off the full Listing Tune-Up — $39 instead of $79</strong> — for the first 10 hosts. Code <strong style="font-family:ui-monospace,SFMono-Regular,monospace;background:#ecfdf5;padding:2px 6px;border-radius:4px;">FLASH50</strong>, expires today at 6pm ET.</p>
<p style="margin:24px 0;">
  <a href="${link}" style="display:inline-block;background:#059669;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:600;">Claim 50% off — $39 Tune-Up →</a>
</p>
<p style="font-size:14px;color:#475569;">What's included: rewritten title + description, 10 restyled photos, 30-day pricing report. 14-day refund window, no subscription.</p>
<p style="font-size:14px;">Reply to this email with any questions.</p>
<p style="font-size:13px;color:#64748b;margin-top:32px;">— Restay<br/><a href="https://restay.agency" style="color:#475569;">restay.agency</a></p>
</body></html>`;
}

async function main() {
  for (const l of leads) {
    const r = await resend.emails.send({
      from: FROM,
      to: [l.email],
      replyTo: REPLY_TO,
      subject: l.subject,
      text: textBody(l),
      html: htmlBody(l),
      tags: [
        { name: "type", value: "warm_lead_flash" },
        { name: "code", value: "FLASH50" },
      ],
    });
    if (r.error) {
      console.error(`FAIL ${l.email}:`, r.error);
    } else {
      console.log(`SENT ${l.email}  resend_id=${r.data?.id}`);
    }
  }
}

main().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1);});
export {};
