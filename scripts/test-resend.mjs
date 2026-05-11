import { Resend } from "resend";
const r = new Resend(process.env.RESEND_API_KEY);
try {
  const res = await r.emails.send({
    from: "onboarding@resend.dev",
    to: process.env.TEST_TO ?? "jack@seifdn.org",
    subject: "Realscale deliverability test",
    text: "If you received this, the Resend API works end-to-end. Domain verification comes next.",
  });
  console.log(res.error ? `FAIL: ${JSON.stringify(res.error)}` : `SENT id=${res.data.id}`);
} catch (e) {
  console.log(`EXC: ${e.message}`);
}
