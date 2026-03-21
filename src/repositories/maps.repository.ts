// src/repositories/maps.repository.ts
import mapsService from '@/integrations/maps.client';
import { GeocodeResult, PlaceDetails, DistanceResult, Coordinates } from '@/types/maps.types';

export class MapsRepository {

  async geocodeAddress(address: string): Promise<GeocodeResult | null> {
    return await mapsService.geocodeAddress(address);
  }

  async reverseGeocode(latitude: number, longitude: number): Promise<GeocodeResult | null> {
    return await mapsService.reverseGeocode(latitude, longitude);
  }

  async searchNearbyPlaces(
    latitude: number,
    longitude: number,
    radius: number,
    query?: string
  ): Promise<PlaceDetails[]> {
    return await mapsService.searchNearbyPlaces(latitude, longitude, radius, query);
  }

  async getDistance(origin: Coordinates, destination: Coordinates): Promise<DistanceResult | null> {
    return await mapsService.getDistance(origin, destination);
  }

  async validateAddress(address: string): Promise<boolean> {
    return await mapsService.validateAddress(address);
  }

  isConfigured(): boolean {
    return mapsService.isConfigured();
  }

  getProviderName(): string {
    return mapsService.getProviderName();
  }
}

export default new MapsRepository();