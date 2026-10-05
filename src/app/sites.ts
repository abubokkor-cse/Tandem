import data from '../data/oah-sites.json';

export interface Site {
  code: string;
  name: string;
  city: string;
  lat: number;
  lon: number;
  distanceKm?: number;
}

// A few official sites have no name; show the city and code instead.
export const SITES: Site[] = data.sites.map((s) => ({ ...s, name: s.name.trim() || `${s.city} site ${s.code}` }));

export function distanceKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLon = ((bLon - aLon) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export function withDistance(lat: number, lon: number): Site[] {
  return SITES.map((s) => ({ ...s, distanceKm: distanceKm(lat, lon, s.lat, s.lon) })).sort((a, b) => a.distanceKm! - b.distanceKm!);
}

export const CITIES = [...new Set(SITES.map((s) => s.city))].sort();
