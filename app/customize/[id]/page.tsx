import { notFound } from "next/navigation";
import { db, orders, listings } from "@/db";
import { eq } from "drizzle-orm";
import { verifyCustomizeToken } from "@/lib/customize-token";

/**
 * Token-gated post-purchase customization editor — no login.
 *
 * URL: /customize/<orderId>?t=<hmac-token>
 *
 * The HMAC token (minted at fulfillment time, emailed to the customer)
 * authenticates the holder as someone who paid the order with the
 * encoded email. The token alone can only edit this one order's
 * customizable fields. See lib/customize-token.ts.
 *
 * Pairs with the existing app/api/customize/[id]/route.ts which
 * provides GET (read fields) and POST (save fields). This page is the
 * user-facing surface.
 *
 * Stub UI below — wire in your merchant-specific fields. The shape
 * lifted from SiteGrid: display name, phone, email, tagline, hours.
 */
export const dynamic = "force-dynamic";

export default async function CustomizePage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ t?: string; saved?: string }>;
}) {
  const [{ id }, { t, saved }] = await Promise.all([
    props.params,
    props.searchParams,
  ]);

  const [order] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  if (!order) notFound();
  if (!order.customerEmail) notFound();
  if (verifyCustomizeToken(t, order.customerEmail) !== id) notFound();

  const [listing] = await db
    .select()
    .from(listings)
    .where(eq(listings.id, order.listingId))
    .limit(1);
  if (!listing) notFound();

  return (
    <main
      style={{
        padding: 48,
        fontFamily: "system-ui",
        maxWidth: 720,
        margin: "auto",
        lineHeight: 1.6,
      }}
    >
      <p
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: "#64748b",
          margin: 0,
        }}
      >
        Customize
      </p>
      <h1 style={{ fontSize: 28, fontWeight: 700, margin: "8px 0 8px 0", lineHeight: 1.2 }}>
        {listing.address}
      </h1>
      <p style={{ color: "#64748b" }}>
        Edit the details below and click <b>Save</b>. Changes go live in ~2 minutes.
        {saved === "1" && (
          <span style={{ color: "#047857", marginLeft: 8, fontWeight: 600 }}>
            ✓ Saved.
          </span>
        )}
      </p>

      <form
        action={`/api/customize/${id}?t=${encodeURIComponent(t ?? "")}`}
        method="POST"
        style={{ display: "grid", gap: 16, marginTop: 32 }}
      >
        <Field
          label="Display name"
          name="displayName"
          defaultValue={listing.agentName ?? ""}
        />
        <Field label="Phone" name="phone" defaultValue={listing.agentPhone ?? ""} />
        <Field label="Email" name="email" defaultValue={listing.agentEmail ?? ""} />
        <Field label="Tagline (one line)" name="tagline" defaultValue="" />
        <Field label="Hours" name="hours" defaultValue="" multiline />
        <button
          type="submit"
          style={{
            background: "#0f172a",
            color: "#fff",
            border: 0,
            borderRadius: 8,
            padding: "12px 20px",
            fontSize: 15,
            fontWeight: 600,
            justifySelf: "start",
            cursor: "pointer",
          }}
        >
          Save changes
        </button>
      </form>

      <p style={{ fontSize: 13, color: "#94a3b8", marginTop: 32 }}>
        Lost this link? Email support and we&apos;ll send a fresh one. No password to reset.
      </p>
    </main>
  );
}

function Field(props: {
  label: string;
  name: string;
  defaultValue: string;
  multiline?: boolean;
}) {
  return (
    <label style={{ display: "block" }}>
      <div
        style={{
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "#64748b",
          marginBottom: 6,
        }}
      >
        {props.label}
      </div>
      {props.multiline ? (
        <textarea
          name={props.name}
          defaultValue={props.defaultValue}
          rows={4}
          style={textareaStyle}
        />
      ) : (
        <input name={props.name} defaultValue={props.defaultValue} style={inputStyle} />
      )}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  border: "1px solid #e2e8f0",
  borderRadius: 8,
  fontSize: 15,
  fontFamily: "inherit",
};
const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  resize: "vertical",
};
