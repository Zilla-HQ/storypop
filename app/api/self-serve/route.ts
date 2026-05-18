import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, listings } from "@/db";
import { inngest } from "@/inngest/client";
import { trackEvent } from "@/lib/posthog";
import { sendMetaEvent } from "@/lib/meta-capi";
import { scoreBookRequest, isQualified } from "@/lib/scoring";
import { uploadToR2, signedR2Url } from "@/lib/r2";

export const runtime = "nodejs";

/**
 * StoryPop self-serve: a parent submits the /create wizard. We validate,
 * optionally upload the photo to R2, persist a book row, fire
 * `book-request/created` to start preview generation, and return the book
 * id so the client can poll.
 *
 * Accepts BOTH multipart/form-data (with photo) and application/json (no
 * photo). The wizard switches based on whether the user picked a file.
 *
 * `listings` is the merchant-template table name; for StoryPop the row
 * stores a book request (childName, age, archetype, description, favorites,
 * optional photo, etc.).
 */

const baseSchema = z.object({
  childName: z.string().min(1).max(40),
  childAge: z.coerce.number().int().min(1).max(12),
  pronouns: z.enum(["he/him", "she/her", "they/them"]).optional(),
  // Legacy enum field. Defaults to "adventure" if neither favorites nor
  // archetype is supplied. The new freeform `description` + `favorites`
  // fields are the primary personalization signal.
  archetype: z
    .enum(["bedtime", "adventure", "first-day", "sibling", "lost-tooth", "birthday"])
    .optional(),
  description: z.string().max(500).optional(),
  favorites: z.string().max(500).optional(),
  stylePreset: z
    .enum(["picture-book-warm", "picture-book-bold", "picture-book-pastel", "watercolor"])
    .optional(),
  defaultHints: z
    .object({
      skinTone: z.enum(["fair", "medium", "tan", "dark"]).optional(),
      hairColor: z.enum(["blonde", "brown", "black", "red", "other"]).optional(),
      hairStyle: z.enum(["short", "long", "curly", "braided"]).optional(),
      glasses: z.boolean().optional(),
    })
    .optional(),
  buyerEmail: z.string().email(),
  eventId: z.string().max(100).optional(),
});

type BookRequest = z.infer<typeof baseSchema> & { photoUrl?: string };

export async function POST(req: NextRequest) {
  let body: BookRequest;
  let uploadedPhotoUrl: string | undefined;

  const contentType = req.headers.get("content-type") ?? "";
  try {
    if (contentType.includes("multipart/form-data")) {
      const fd = await req.formData();
      const raw = {
        childName: String(fd.get("childName") ?? ""),
        childAge: Number(fd.get("childAge") ?? 0),
        pronouns: (fd.get("pronouns") as string) || undefined,
        archetype: (fd.get("archetype") as string) || undefined,
        description: (fd.get("description") as string) || undefined,
        favorites: (fd.get("favorites") as string) || undefined,
        buyerEmail: String(fd.get("buyerEmail") ?? ""),
      };
      body = baseSchema.parse(raw);

      // If a photo was attached, upload it to R2 and use the signed URL.
      const photo = fd.get("photo");
      if (photo && photo instanceof File && photo.size > 0) {
        const ext = photo.type === "image/png" ? "png" : "jpg";
        const key = `uploads/${crypto.randomUUID()}.${ext}`;
        const buf = Buffer.from(await photo.arrayBuffer());
        try {
          await uploadToR2(key, buf, photo.type || "image/jpeg");
          uploadedPhotoUrl = await signedR2Url(key, 60 * 60 * 24 * 30);
        } catch (err) {
          // Non-fatal: proceed without photo (text-only generation works).
          console.warn("[self-serve] photo upload to R2 failed:", err);
        }
      }
    } else {
      body = baseSchema.parse(await req.json());
    }
  } catch (err) {
    return NextResponse.json({ error: "Invalid input", details: String(err) }, { status: 400 });
  }

  // Default archetype to "adventure" when the caller didn't pick one
  // (the wizard no longer surfaces the 6-option grid).
  const archetype = body.archetype ?? "adventure";

  const score = scoreBookRequest({
    childName: body.childName,
    childAge: body.childAge,
    pronouns: body.pronouns ?? null,
    archetype,
    photoUrl: uploadedPhotoUrl ?? null,
  });
  const qualified = isQualified({
    completeness: score.completeness,
    photoClarityScore: null,
  });
  if (!qualified.qualified) {
    return NextResponse.json({ error: qualified.reason }, { status: 400 });
  }

  let bookId: string | undefined;
  try {
    const inserted = await db
      .insert(listings)
      .values({
        childName: body.childName,
        childAge: body.childAge,
        pronouns: body.pronouns ?? null,
        archetype,
        description: body.description ?? null,
        favorites: body.favorites ?? null,
        photoUrl: uploadedPhotoUrl ?? null,
        stylePreset: body.stylePreset ?? "picture-book-warm",
        defaultCharacterHints: body.defaultHints ?? null,
        primaryContactEmail: body.buyerEmail,
        photoExpiresAt: uploadedPhotoUrl
          ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
          : null,
        createdAt: new Date(),
      })
      .returning({ id: listings.id });
    bookId = inserted[0]?.id;
  } catch (err) {
    // Surface DB-connection failures as a clear 503 rather than letting
    // Next render the default HTML 500 page (which the client then chokes
    // on with "Unexpected end of JSON input").
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[self-serve] DB insert failed:", msg);
    return NextResponse.json(
      {
        error:
          msg.includes("DATABASE_URL")
            ? "DATABASE_URL is not configured on the server. Add it in the project's environment settings."
            : `Database error: ${msg.slice(0, 200)}`,
      },
      { status: 503 },
    );
  }
  if (!bookId) {
    return NextResponse.json({ error: "Failed to create book" }, { status: 500 });
  }

  await inngest.send({ name: "book-request/created", data: { bookId } }).catch((err) => {
    console.warn("[self-serve] Inngest dispatch failed:", err);
  });

  await Promise.allSettled([
    trackEvent({
      distinctId: bookId,
      event: "book_request_submitted",
      properties: { bookId, archetype, has_photo: !!uploadedPhotoUrl },
    }),
    // Form submission = Lead. InitiateCheckout fires later from
    // /api/checkout when the buyer picks a price tier.
    sendMetaEvent("Lead", { bookId, eventId: body.eventId }).catch(() => {}),
  ]);

  return NextResponse.json({ bookId });
}
