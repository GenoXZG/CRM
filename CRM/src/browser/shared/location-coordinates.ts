export interface Coordinates { lat: number; lng: number }

export function coordinates(lat: string | number | null, lng: string | number | null): Coordinates | null {
  if (lat === null || lng === null || String(lat).trim() === '' || String(lng).trim() === '') return null;
  const latitude = Number(lat), longitude = Number(lng);
  return Number.isFinite(latitude) && Number.isFinite(longitude) && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180
    ? { lat: latitude, lng: longitude } : null;
}
function pair(value: string | null): Coordinates | null {
  const match = value?.trim().match(/^(?:loc:)?\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
  return match ? coordinates(match[1]!, match[2]!) : null;
}
export function coordinatesFromLink(value: string): Coordinates | null {
  const direct = pair(value);
  if (direct) return direct;
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    if (url.hostname === 'openstreetmap.org' || url.hostname === 'www.openstreetmap.org')
      return coordinates(url.searchParams.get('mlat'), url.searchParams.get('mlon'));
    if (!/^(?:www\.|maps\.)?google\.(?:com|com\.mx|es)$/.test(url.hostname)) return null;
    // A Google URL's @latitude,longitude is the viewport, not necessarily the selected place.
    const places = [...url.pathname.matchAll(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/g)];
    if (places.length === 1) return coordinates(places[0]![1]!, places[0]![2]!);
    if (places.length > 1) return null;
    const search = url.pathname.match(/^\/maps\/(?:search|place)\/([^/]+)\/?$/);
    return pair(url.searchParams.get('q')) || pair(url.searchParams.get('query')) ||
      (search ? pair(decodeURIComponent(search[1]!).replace(/\+/g, ' ')) : null);
  } catch { return null; }
}
export function isShortMapsLink(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.port &&
      ((url.hostname === 'maps.app.goo.gl' && /^\/[A-Za-z0-9_-]+\/?$/.test(url.pathname)) ||
       (url.hostname === 'goo.gl' && /^\/maps\/[A-Za-z0-9_-]+\/?$/.test(url.pathname)));
  } catch { return false; }
}
export function coordinatesLink(point: Coordinates): string {
  return `https://www.google.com/maps?q=${point.lat.toFixed(6)},${point.lng.toFixed(6)}`;
}
