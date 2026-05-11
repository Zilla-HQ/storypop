/**
 * Pull every available public/shareable URL for a Meta ad — Ads Library
 * URL, the video creative permalink on the Page, and the source MP4.
 *
 *   npx tsx --env-file=.env.local scripts/get-meta-ad-public-url.ts <ad_id>
 */
const TOKEN = process.env.META_ADS_ACCESS_TOKEN!;
const V = process.env.META_API_VERSION || "v19.0";
const BASE = `https://graph.facebook.com/${V}`;

async function main() {
  const adId = process.argv[2];
  if (!adId) {
    console.error("Usage: scripts/get-meta-ad-public-url.ts <ad_id>");
    process.exit(1);
  }

  // 1. Get the ad's creative_id
  const adRes = await fetch(
    `${BASE}/${adId}?fields=name,creative_id&access_token=${encodeURIComponent(TOKEN)}`,
  );
  const ad = (await adRes.json()) as {
    name?: string;
    creative_id?: string;
    error?: { message: string };
  };
  if (ad.error) {
    console.error("✗", ad.error.message);
    process.exit(1);
  }
  console.log(`AD: ${ad.name ?? "(unknown name)"}`);
  console.log(`  ID:                 ${adId}`);
  console.log(`  Creative ID:        ${ad.creative_id ?? "(none)"}`);

  // 1b. Now query the creative directly for video + page-post info
  let videoId: string | undefined;
  let pageId: string | undefined;
  let effectiveStoryId: string | undefined;
  if (ad.creative_id) {
    const cRes = await fetch(
      `${BASE}/${ad.creative_id}?fields=video_id,thumbnail_url,object_story_spec,effective_object_story_id&access_token=${encodeURIComponent(TOKEN)}`,
    );
    const c = (await cRes.json()) as {
      video_id?: string;
      effective_object_story_id?: string;
      object_story_spec?: { page_id?: string; video_data?: { video_id?: string } };
      error?: { message: string };
    };
    if (c.error) {
      console.log(`  Creative lookup failed: ${c.error.message}`);
    } else {
      videoId = c.video_id ?? c.object_story_spec?.video_data?.video_id;
      pageId = c.object_story_spec?.page_id;
      effectiveStoryId = c.effective_object_story_id;
      console.log(`  Video ID:           ${videoId ?? "(none)"}`);
      console.log(`  Page ID:            ${pageId ?? "(none)"}`);
      console.log(`  Effective story ID: ${effectiveStoryId ?? "(none)"}`);
    }
  }

  // 2. Get the video's source URL + permalink (if we have a video ID)
  if (videoId) {
    const vRes = await fetch(
      `${BASE}/${videoId}?fields=source,permalink_url,picture,description,title&access_token=${encodeURIComponent(TOKEN)}`,
    );
    const v = (await vRes.json()) as {
      source?: string;
      permalink_url?: string;
      picture?: string;
      description?: string;
      title?: string;
      error?: { message: string };
    };
    if (v.error) {
      console.log(`\n  Video lookup failed: ${v.error.message}`);
    } else {
      console.log(`\nVIDEO ${videoId}:`);
      console.log(`  Title:              ${v.title ?? "(none)"}`);
      console.log(`  Permalink (public): https://www.facebook.com${v.permalink_url ?? "(none)"}`);
      console.log(`  Source MP4:         ${v.source ?? "(unavailable)"}`);
      console.log(`  Thumbnail:          ${v.picture ?? "(none)"}`);
    }
  }

  // 3. Effective story ID — if the creative is a Page post, this is its public URL
  if (effectiveStoryId) {
    console.log(`\nPAGE POST PERMALINK:`);
    const [, postId] = effectiveStoryId.split("_");
    if (pageId && postId) {
      console.log(`  https://www.facebook.com/${pageId}/posts/${postId}`);
    } else {
      console.log(`  https://www.facebook.com/${effectiveStoryId.replace("_", "/posts/")}`);
    }
  }

  // 4. Ads Library URL (works for US ads in some categories — try it)
  console.log(`\nADS LIBRARY (try this first — works without login):`);
  console.log(`  https://www.facebook.com/ads/library/?id=${adId}`);
}

main().catch((err) => {
  console.error("\n✗", err);
  process.exit(1);
});

export {};
