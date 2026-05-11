import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, listings } from "@/db";
import { inngest } from "@/inngest/client";
import { trackEvent } from "@/lib/posthog";
import { sendMetaEvent } from "@/lib/meta-capi";
import { scoreBookRequest, isQualified } from "@/lib/scoring";

export const runtime = "nodejs";

/**
 * StoryPop self-serve: a parent submits the `/create` form. We validate,
 * persist a book row, fire `book-request/created` to start preview
 * generation, and return the book id so the client can poll.
 *
 * `listings` is the merchant-template table name; for StoryPop the row
 * stores a book request (childName, age, archetype, photo, etc.).
 */

const bodySchema = z.object({
  childName: z.string().min(1).max(40),
  childAge: z.number().int().min(1).max(12),
  pronouns: z.enum(["he/him", "she/her", "they/them"]).optional(),
  archetype: z.enum([
    "bedtime",
    "adventure",
    "first-day",
    "sibling",
    "lost-tooth",
    "birthday",
  ]),
  photoUrl: z.string().url().optional(),
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

export async function POST(req: NextRequest) {
  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch (err) {
    return NextResponse.json({ error: "Invalid input", details: String(err) }, { status: 400 });
  }

  const score = scoreBookRequest({
    childName: body.childName,
    childAge: body.childAge,
    pronouns: body.pronouns ?? null,
    archetype: body.archetype,
    photoUrl: body.photoUrl ?? null,
  });
  const qualified = isQualified({
    completeness: score.completeness,
    photoClarityScore: null, // computed async by lib/vision.ts if a photo is uploaded
  });
  if (!qualified.qualified) {
    return NextResponse.json({ error: qualified.reason }, { status: 400 });
  }

  const inserted = await db
    .insert(listings)
    .values({
      childName: body.childName,
      childAge: body.childAge,
      pronouns: body.pronouns ?? null,
      archetype: body.archetype,
      photoUrl: body.photoUrl ?? null,
      stylePreset: body.stylePreset ?? "picture-book-warm",
      defaultCharacterHints: body.defaultHints ?? null,
      primaryContactEmail: body.buyerEmail,
      photoExpiresAt: body.photoUrl
        ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        : null,
      createdAt: new Date(),
    })
    .returning({ id: listings.id });
  const bookId = inserted[0]?.id;
  if (!bookId) {
    return NextResponse.json({ error: "Failed to create book" }, { status: 500 });
  }

  await inngest.send({
    name: "book-request/created",
    data: { bookId },
  });

  await Promise.allSettled([
    trackEvent("book_request_submitted", { bookId, archetype: body.archetype }),
    sendMetaEvent("InitiateCheckout", { bookId, eventId: body.eventId }),
  ]);

  return NextResponse.json({ bookId });
}
