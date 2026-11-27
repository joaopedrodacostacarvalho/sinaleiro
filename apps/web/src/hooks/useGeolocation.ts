import { useEffect, useState } from 'react';

interface GeolocationState {
  coords: { lat: number; lng: number } | null;
  accuracy: number | null;
  error: string | null;
  loading: boolean;
}

export function useGeolocation(): GeolocationState {
  const [state, setState] = useState<GeolocationState>({
    coords: null,
    accuracy: null,
    error: null,
    loading: true,
  });

  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setState({
        coords: null,
        accuracy: null,
        error: 'Geolocalização indisponível neste navegador',
        loading: false,
      });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setState({
          coords: { lat: pos.coords.latitude, lng: pos.coords.longitude },
          accuracy: pos.coords.accuracy,
          error: null,
          loading: false,
        });
      },
      (err) => {
        setState({
          coords: null,
          accuracy: null,
          error: err.message,
          loading: false,
        });
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 },
    );
  }, []);

  return state;
}
