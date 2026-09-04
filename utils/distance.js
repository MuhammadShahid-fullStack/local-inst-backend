// Great-circle distance between two lat/lng points, in meters.
// Used to verify a student's submitted GPS position against a class's
// configured location - always computed server-side, never trusted
// from the client.

const EARTH_RADIUS_METERS = 6371000;

const toRadians = (degrees) => (degrees * Math.PI) / 180;

export const getDistanceInMeters = (lat1, lon1, lat2, lon2) => {
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_METERS * c;
};
