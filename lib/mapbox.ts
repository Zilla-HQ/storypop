import { env } from "@/lib/env";

const TOKEN = env("NEXT_PUBLIC_MAPBOX_TOKEN");

export interface GeocodeResult {
  lng: number;
  lat: number;
  full_address: string;
  zip?: string;
}

export async function geocodeAddress(query: string): Promise<GeocodeResult | null> {
  if (!TOKEN) throw new Error("NEXT_PUBLIC_MAPBOX_TOKEN not set");
  const url =
    `https://api.mapbox.com/search/geocode/v6/forward?` +
    `q=${encodeURIComponent(query)}&country=us&limit=1&types=address` +
    `&access_token=${TOKEN}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = (await res.json()) as {
    features?: Array<{
      properties: {
        full_address: string;
        coordinates: { longitude: number; latitude: number };
        context?: { postcode?: { name?: string } };
      };
    }>;
  };
  const f = data.features?.[0];
  if (!f) return null;
  return {
    lng: f.properties.coordinates.longitude,
    lat: f.properties.coordinates.latitude,
    full_address: f.properties.full_address,
    zip: f.properties.context?.postcode?.name,
  };
}

/**
 * Returns a satellite tile URL for a given lat/lng + zoom.
 * Zoom 18 is roughly "house + yard" — enough to see backyard, pool, roof.
 * Zoom 17 captures a wider lot. Zoom 19 zooms in tight on the structure.
 *
 * Mapbox returns the image directly when this URL is fetched.
 */
export function satelliteTileUrl(args: {
  lng: number;
  lat: number;
  zoom?: number;
  width?: number;
  height?: number;
}): string {
  if (!TOKEN) throw new Error("NEXT_PUBLIC_MAPBOX_TOKEN not set");
  const zoom = args.zoom ?? 18.5;
  const width = args.width ?? 1024;
  const height = args.height ?? 768;
  return (
    `https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static/` +
    `${args.lng},${args.lat},${zoom},0/${width}x${height}@2x` +
    `?access_token=${TOKEN}&attribution=false&logo=false`
  );
}
