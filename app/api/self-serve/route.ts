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
          // AWS SigV4 caps presigned GET URLs at 7 days max. We previously
          // requested 30 days here, which made signedR2Url() throw — the
          // photo was uploaded successfully to R2 but the URL signing failed,
          // photoUrl stayed null, and downstream lockCharacter() fell back
          // to the default LoRA. Customer's actual kid never appeared in
          // the book. 7 days is plenty: the preview Inngest function uses
          // the URL within ~60s of submission to train the LoRA, after which
          // the URL isn't read again.
          uploadedPhotoUrl = await signedR2Url(key, 60 * 60 * 24 * 7);
          console.log(
            `[self-serve] photo uploaded: size=${buf.length} key=${key} url=${uploadedPhotoUrl.slice(0, 80)}...`,
          );
        } catch (err) {
          // LOUD log so the team can see this in Vercel runtime logs. Earlier
          // this was a silent warn() and we shipped books with no photo —
          // customer reported the kid in their book wasn't theirs. The fact
          // that this is non-fatal (book still generates with a default
          // character) is correct, but the operator MUST be able to see
          // when it happens.
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`[self-serve] R2 photo upload FAILED — bytes=${buf.length} bucket=storypop-books key=${key} err=${msg}`);
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
