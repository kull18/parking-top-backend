// src/integrations/maps.client.ts
import { config } from '@/config/environment';
import mapboxService from './mapbox.client';
import logger from '@/utils/logger';
import { GeocodeResult, PlaceDetails, DistanceResult, Coordinates } from '@/types/maps.types';

/**
 * Servicio unificado de mapas
 * Por ahora solo usa Mapbox (Google Maps opcional)
 */
class MapsService {
  
  async geocodeAddress(address: string): Promise<GeocodeResult | null> {
    return await mapboxService.geocodeAddress(address);
  }

  async reverseGeocode(latitude: number, longitude: number): Promise<GeocodeResult | null> {
    return await mapboxService.reverseGeocode(latitude, longitude);
  }

  async searchNearbyPlaces(
    latitude: number,
    longitude: number,
    radius: number = 1000,
    query?: string
  ): Promise<PlaceDetails[]> {
    return await mapboxService.searchNearbyPlaces(latitude, longitude, radius, query);
  }

  async getDistance(origin: Coordinates, destination: Coordinates): Promise<DistanceResult | null> {
    return await mapboxService.getDistance(origin, destination);
  }

  async validateAddress(address: string): Promise<boolean> {
    return await mapboxService.validateAddress(address);
  }

  isConfigured(): boolean {
    return mapboxService.isConfigured();
  }

  getProviderName(): string {
    return 'mapbox';
  }
}

export default new MapsService();