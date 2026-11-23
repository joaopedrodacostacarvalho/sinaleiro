export interface Coordenada {
  lat: number;
  lng: number;
}

const RAIO_TERRA_M = 6_371_000;
const rad = (deg: number): number => (deg * Math.PI) / 180;

export function haversineMetros(a: Coordenada, b: Coordenada): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const lat1 = rad(a.lat);
  const lat2 = rad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * RAIO_TERRA_M * Math.asin(Math.sqrt(h));
}
