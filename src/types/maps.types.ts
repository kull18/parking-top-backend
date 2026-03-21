// src/types/maps.types.ts

export interface GeocodeResult {
  latitude: number;
  longitude: number;
  formattedAddress: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

export interface PlaceDetails {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  placeId: string;
  types: string[];
}

export interface DistanceResult {
  distance: number; // en metros
  duration: number; // en segundos
}

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface IMapsProvider {
  geocodeAddress(address: string): Promise<GeocodeResult | null>;
  reverseGeocode(latitude: number, longitude: number): Promise<GeocodeResult | null>;
  searchNearbyPlaces(latitude: number, longitude: number, radius?: number, query?: string): Promise<PlaceDetails[]>;
  getDistance(origin: Coordinates, destination: Coordinates): Promise<DistanceResult | null>;
  validateAddress(address: string): Promise<boolean>;
  isConfigured(): boolean;
}