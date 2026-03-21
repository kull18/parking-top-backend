// src/integrations/mapbox.client.ts
import axios from 'axios';
import { config } from '@/config/environment';
import logger from '@/utils/logger';
import { GeocodeResult, PlaceDetails, DistanceResult, Coordinates, IMapsProvider } from '@/types/maps.types';

export class MapboxService implements IMapsProvider {
  private accessToken: string;
  private baseUrl = 'https://api.mapbox.com';

  constructor() {
    this.accessToken = config.maps.mapboxToken || '';

    if (!this.accessToken) {
      logger.warn('Mapbox access token not configured');
    }
  }

  async geocodeAddress(address: string): Promise<GeocodeResult | null> {
    if (!this.accessToken) {
      logger.error('Mapbox access token not configured');
      return null;
    }

    try {
      const response = await axios.get(
        `${this.baseUrl}/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json`,
        {
          params: {
            access_token: this.accessToken,
            language: 'es',
            limit: 1
          }
        }
      );

      if (!response.data.features || response.data.features.length === 0) {
        logger.warn(`Geocoding failed for address: ${address}`);
        return null;
      }

      const feature = response.data.features[0];
      const [longitude, latitude] = feature.center;

      const context = feature.context || [];
      const city = this.findContextValue(context, 'place');
      const state = this.findContextValue(context, 'region');
      const postalCode = this.findContextValue(context, 'postcode');
      const country = this.findContextValue(context, 'country');

      return {
        latitude,
        longitude,
        formattedAddress: feature.place_name,
        city,
        state,
        postalCode,
        country
      };
    } catch (error: any) {
      logger.error('Error geocoding address:', {
        message: error.message,
        address
      });
      return null;
    }
  }

  async reverseGeocode(latitude: number, longitude: number): Promise<GeocodeResult | null> {
    if (!this.accessToken) {
      logger.error('Mapbox access token not configured');
      return null;
    }

    try {
      const response = await axios.get(
        `${this.baseUrl}/geocoding/v5/mapbox.places/${longitude},${latitude}.json`,
        {
          params: {
            access_token: this.accessToken,
            language: 'es',
            limit: 1
          }
        }
      );

      if (!response.data.features || response.data.features.length === 0) {
        logger.warn(`Reverse geocoding failed for: ${latitude},${longitude}`);
        return null;
      }

      const feature = response.data.features[0];
      const [lng, lat] = feature.center;

      const context = feature.context || [];
      const city = this.findContextValue(context, 'place');
      const state = this.findContextValue(context, 'region');
      const postalCode = this.findContextValue(context, 'postcode');
      const country = this.findContextValue(context, 'country');

      return {
        latitude: lat,
        longitude: lng,
        formattedAddress: feature.place_name,
        city,
        state,
        postalCode,
        country
      };
    } catch (error: any) {
      logger.error('Error reverse geocoding:', {
        message: error.message,
        latitude,
        longitude
      });
      return null;
    }
  }

  async searchNearbyPlaces(
    latitude: number,
    longitude: number,
    radius: number = 1000,
    query?: string
  ): Promise<PlaceDetails[]> {
    if (!this.accessToken) {
      logger.error('Mapbox access token not configured');
      return [];
    }

    try {
      const searchQuery = query || 'parking';
      
      const response = await axios.get(
        `${this.baseUrl}/geocoding/v5/mapbox.places/${encodeURIComponent(searchQuery)}.json`,
        {
          params: {
            access_token: this.accessToken,
            proximity: `${longitude},${latitude}`,
            limit: 10,
            language: 'es'
          }
        }
      );

      if (!response.data.features) {
        return [];
      }

      const radiusInKm = radius / 1000;
      
      return response.data.features
        .filter((feature: any) => {
          const [lng, lat] = feature.center;
          const distance = this.calculateDistance(latitude, longitude, lat, lng);
          return distance <= radiusInKm;
        })
        .map((feature: any) => {
          const [lng, lat] = feature.center;
          return {
            name: feature.text,
            address: feature.place_name,
            latitude: lat,
            longitude: lng,
            placeId: feature.id,
            types: feature.place_type || []
          };
        });
    } catch (error: any) {
      logger.error('Error searching nearby places:', {
        message: error.message,
        latitude,
        longitude,
        radius
      });
      return [];
    }
  }

  async getDistance(origin: Coordinates, destination: Coordinates): Promise<DistanceResult | null> {
    if (!this.accessToken) {
      logger.error('Mapbox access token not configured');
      return null;
    }

    try {
      const response = await axios.get(
        `${this.baseUrl}/directions/v5/mapbox/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}`,
        {
          params: {
            access_token: this.accessToken,
            geometries: 'geojson'
          }
        }
      );

      if (!response.data.routes || response.data.routes.length === 0) {
        logger.warn('Distance calculation failed');
        return null;
      }

      const route = response.data.routes[0];

      return {
        distance: route.distance,
        duration: route.duration
      };
    } catch (error: any) {
      logger.error('Error calculating distance:', {
        message: error.message,
        origin,
        destination
      });
      return null;
    }
  }

  async validateAddress(address: string): Promise<boolean> {
    const result = await this.geocodeAddress(address);
    return result !== null;
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(lat1)) *
        Math.cos(this.deg2rad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  private findContextValue(context: any[], type: string): string | undefined {
    const item = context.find((c: any) => c.id.startsWith(type));
    return item?.text;
  }

  isConfigured(): boolean {
    return !!this.accessToken;
  }
}

export default new MapboxService();