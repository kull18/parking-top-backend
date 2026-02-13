import { config } from '@/config/environment';
import logger from '@/utils/logger';
import {
  MapboxGeocodeResponse,
  MapboxDirectionsResponse
} from '@/types/interfaces';

export class MapboxService {
  private baseUrl = 'https://api.mapbox.com';

  async geocodeAddress(address: string) {
    try {
      const url = `${this.baseUrl}/geocoding/v5/mapbox.places/${encodeURIComponent(
        address
      )}.json?access_token=${config.maps.mapboxToken}`;

      const response = await fetch(url);
      const data = (await response.json()) as MapboxGeocodeResponse;

      if (!data.features || data.features.length === 0) {
        throw new Error('No se encontró la dirección');
      }

      // ✅ center está en el feature, no en el response
      const feature = data.features[0];

      return {
        latitude: feature.center[1],
        longitude: feature.center[0],
        formattedAddress: feature.place_name,
        placeId: feature.id
      };
    } catch (error) {
      logger.error('Error geocoding with Mapbox:', error);
      throw error;
    }
  }

  async reverseGeocode(latitude: number, longitude: number) {
    try {
      const url = `${this.baseUrl}/geocoding/v5/mapbox.places/${longitude},${latitude}.json?access_token=${config.maps.mapboxToken}`;

      const response = await fetch(url);
      const data = (await response.json()) as MapboxGeocodeResponse;

      if (!data.features || data.features.length === 0) {
        throw new Error('No se encontró la ubicación');
      }

      const feature = data.features[0];

      return {
        address: feature.place_name,
        placeId: feature.id
      };
    } catch (error) {
      logger.error('Error reverse geocoding with Mapbox:', error);
      throw error;
    }
  }

  async getDirections(
    origin: [number, number],
    destination: [number, number],
    profile: 'driving' | 'walking' | 'cycling' = 'driving'
  ) {
    try {
      const coordinates = `${origin[0]},${origin[1]};${destination[0]},${destination[1]}`;
      const url = `${this.baseUrl}/directions/v5/mapbox/${profile}/${coordinates}?access_token=${config.maps.mapboxToken}&geometries=geojson`;

      const response = await fetch(url);
      // ✅ Castear a MapboxDirectionsResponse para evitar 'unknown'
      const data = (await response.json()) as MapboxDirectionsResponse;

      if (!data.routes || data.routes.length === 0) {
        throw new Error('No se encontró una ruta');
      }

      const route = data.routes[0];

      return {
        distance: route.distance,
        duration: route.duration,
        geometry: route.geometry
      };
    } catch (error) {
      logger.error('Error getting directions from Mapbox:', error);
      throw error;
    }
  }
}

export default new MapboxService();