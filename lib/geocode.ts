// lib/geocode.ts — address autocomplete, server-side only.
//
// Type-ahead address suggestions with full structured components, so selecting a
// suggestion can auto-fill street / city / state / ZIP / country. Uses Komoot's
// free Photon API (OpenStreetMap-based, built for autocomplete, no API key) with
// a Nominatim fallback. Every path fails soft — on any error we return [] and the
// form falls back to plain manual entry.
//
// To upgrade to Google Places later, add a provider branch here keyed on an env
// var; the AddressSuggestion shape already carries everything the UI needs.

export interface AddressSuggestion {
  id: string;
  /** Full one-line label shown in the dropdown. */
  label: string;
  line1: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
}

const TIMEOUT_MS = 6000;

function compose(parts: (string | undefined | null)[]): string {
  return parts.map((p) => (p ?? "").trim()).filter(Boolean).join(", ");
}

/** Photon (Komoot) — GeoJSON features with structured address properties. */
async function fromPhoton(query: string): Promise<AddressSuggestion[]> {
  const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=6&lang=en`;
  const res = await fetch(url, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { "User-Agent": "Sipfluence/1.0 (partner portal)" },
  });
  if (!res.ok) throw new Error(`photon ${res.status}`);
  const data = await res.json();
  const feats: any[] = Array.isArray(data?.features) ? data.features : [];
  const out: AddressSuggestion[] = [];
  for (const f of feats) {
    const p = f?.properties ?? {};
    const street = p.street || p.name || "";
    const line1 = p.housenumber ? `${p.housenumber} ${street}`.trim() : street;
    const city = p.city || p.town || p.village || p.district || p.county || "";
    const region = p.state || "";
    const postalCode = p.postcode || "";
    const country = p.country || "";
    if (!line1 && !city) continue;
    out.push({
      id: String(p.osm_id ?? `${f?.geometry?.coordinates ?? Math.random()}`),
      label: compose([line1, city, region, postalCode, country]) || p.name || query,
      line1,
      city,
      region,
      postalCode,
      country,
    });
  }
  return out;
}

/** Nominatim fallback — structured addressdetails. Lower rate limits, so only used if Photon fails. */
async function fromNominatim(query: string): Promise<AddressSuggestion[]> {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
    query,
  )}&format=jsonv2&addressdetails=1&limit=6`;
  const res = await fetch(url, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { "User-Agent": "Sipfluence/1.0 (partner portal; support@brecx.com)" },
  });
  if (!res.ok) throw new Error(`nominatim ${res.status}`);
  const rows: any[] = await res.json();
  const out: AddressSuggestion[] = [];
  for (const r of rows) {
    const a = r.address ?? {};
    const houseNo = a.house_number ? `${a.house_number} ` : "";
    const street = a.road || a.pedestrian || a.footway || "";
    const line1 = `${houseNo}${street}`.trim();
    const city = a.city || a.town || a.village || a.hamlet || a.suburb || a.county || "";
    const region = a.state || a.region || "";
    const postalCode = a.postcode || "";
    const country = a.country || "";
    if (!line1 && !city) continue;
    out.push({
      id: String(r.place_id ?? r.osm_id ?? Math.random()),
      label: compose([line1, city, region, postalCode, country]) || r.display_name || query,
      line1,
      city,
      region,
      postalCode,
      country,
    });
  }
  return out;
}

/** Return up to 6 address suggestions for a partial query. Never throws. */
export async function searchAddresses(query: string): Promise<AddressSuggestion[]> {
  const q = (query ?? "").trim();
  if (q.length < 3) return [];
  try {
    const photon = await fromPhoton(q);
    if (photon.length) return photon;
  } catch {
    // fall through to Nominatim
  }
  try {
    return await fromNominatim(q);
  } catch {
    return [];
  }
}
