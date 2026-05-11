/**
 * Pluggable paid-tier staging provider. Default = REimagineHome.
 * To swap providers (Virtual Staging AI, etc.), add a new module that exports
 * the same `stagePhoto` signature and wire it up via the STAGING_PROVIDER env.
 */

const BASE = process.env.REIMAGINEHOME_BASE_URL ?? "https://api.reimaginehome.ai";
const apiKey = process.env.REIMAGINEHOME_API_KEY;
const provider = process.env.STAGING_PROVIDER ?? "reimaginehome";

export type StagingMode = "interior" | "exterior_sky_replace" | "exterior_twilight";

export interface StagingArgs {
  sourceImageUrl: string;
  mode: StagingMode;
  stylePreset: string; // modern|farmhouse|midcentury|coastal
  roomHint?: string;
}

export interface StagingResult {
  url: string;
  costCents: number;
  providerJobId?: string;
}

/**
 * Stage a single photo. Thin wrapper so the agent can swap providers.
 * On failure, throws — caller should retry via Inngest step.
 */
export async function stagePhoto(args: StagingArgs): Promise<StagingResult> {
  // Default to fal.ai — same provider as the preview agent, already wired
  // and credentialed. STAGING_PROVIDER=reimaginehome opts into the original
  // spec path if that key is configured.
  if (provider !== "reimaginehome") {
    const { generateStagedPreview } = await import("@/lib/falai");
    const result = await generateStagedPreview({
      sourceImageUrl: args.sourceImageUrl,
      styleFragment: styleMap(args.stylePreset),
      roomHint: args.roomHint ?? "living_room",
    });
    return { url: result.url, costCents: result.costCents };
  }
  if (!apiKey) {
    throw new Error("REIMAGINEHOME_API_KEY is not set");
  }

  // Endpoint shape is best-effort — REimagineHome's public docs list a /v1/create endpoint
  // that accepts an image URL + design/mode parameters. Adjust once we pilot against real API.
  const res = await fetch(`${BASE}/v1/create_virtual_stagings`, {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      image_url: args.sourceImageUrl,
      design_type: designTypeFor(args.mode),
      design_style: styleMap(args.stylePreset),
      room_type: args.roomHint ?? "living_room",
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`REimagineHome ${res.status}: ${text}`);
  }

  const body = (await res.json()) as {
    job_id?: string;
    output_url?: string;
    image_url?: string;
  };

  // Some endpoints return the rendered URL inline; others return a job id to poll.
  const url = body.output_url ?? body.image_url;
  if (!url) {
    // Poll for up to 90s if we got a job id.
    if (body.job_id) {
      const polled = await pollReimagineJob(body.job_id);
      return { url: polled, costCents: 40, providerJobId: body.job_id };
    }
    throw new Error("REimagineHome returned no image URL");
  }

  // Cost estimate — refine per plan pricing.
  return { url, costCents: 40, providerJobId: body.job_id };
}

async function pollReimagineJob(jobId: string, timeoutMs = 90_000): Promise<string> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    await new Promise((r) => setTimeout(r, 3_000));
    const res = await fetch(`${BASE}/v1/status/${jobId}`, {
      headers: { "api-key": apiKey ?? "" },
    });
    if (!res.ok) continue;
    const body = (await res.json()) as { status?: string; output_url?: string };
    if (body.status === "completed" && body.output_url) return body.output_url;
    if (body.status === "failed") throw new Error("REimagineHome job failed");
  }
  throw new Error("REimagineHome job polling timed out");
}

function designTypeFor(mode: StagingMode): string {
  switch (mode) {
    case "interior":
      return "furnish";
    case "exterior_sky_replace":
      return "sky_replacement";
    case "exterior_twilight":
      return "twilight";
    default:
      return "furnish";
  }
}

function styleMap(preset: string): string {
  const m: Record<string, string> = {
    modern: "modern",
    farmhouse: "farmhouse",
    midcentury: "midcentury",
    coastal: "coastal",
  };
  return m[preset] ?? "modern";
}

export function inferMode(photoUrl: string, index: number): StagingMode {
  // Heuristic: exteriors tend to be photos 0-1 (MLS hero shots). Rough — caller can override.
  if (index === 0) return "exterior_sky_replace";
  return "interior";
}
