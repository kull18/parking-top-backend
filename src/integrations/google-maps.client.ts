// src/integrations/google-maps.client.ts
import { Client } from '@googlemaps/google-maps-services-js';
import { config } from '@/config/environment';
import logger from '@/utils/logger';
import { GeocodeResult, PlaceDetails, DistanceResult, Coordinates, IMapsProvider } from '@/types/maps.types';

const mapsClient = new Client({});

export class GoogleMapsService implements IMapsProvider {
  private apiKey: string;

  constructor() {
    this.apiKey = config.maps.googleApiKey || '';
    
    if (!this.apiKey) {
      logger.warn('Google Maps API key not configured');
    }
  }

  async geocodeAddress(address: string): Promise<GeocodeResult | null> {
    if (!this.apiKey) {
      logger.error('Google Maps API key not configured');
      return null;
    }

    try {
      const response = await mapsClient.geocode({
        params: {
          address,
          key: this.apiKey
        }
      });

      if (response.data.results.length === 0) {
        logger.warn(`Geocoding failed for address: ${address}`);
        return null;
      }

      const result = response.data.results[0];
      
      // Extraer componentes de dirección
      const components = result.address_components;
      const city = this.findComponent(components, 'locality');
      const state = this.findComponent(components, 'administrative_area_level_1');
      const postalCode = this.findComponent(components, 'postal_code');
      const country = this.findComponent(components, 'country');

      return {
        latitude: result.geometry.location.lat,
        longitude: result.geometry.location.lng,
        formattedAddress: result.formatted_address,
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
    if (!this.apiKey) {
      logger.error('Google Maps API key not configured');
      return null;
    }

    try {
      const response = await mapsClient.reverseGeocode({
        params: {
          latlng: { lat: latitude, lng: longitude },
          key: this.apiKey
        }
      });

      if (response.data.results.length === 0) {
        logger.warn(`Reverse geocoding failed for: ${latitude},${longitude}`);
        return null;
      }

      const result = response.data.results[0];

      const components = result.address_components;
      const city = this.findComponent(components, 'locality');
      const state = this.findComponent(components, 'administrative_area_level_1');
      const postalCode = this.findComponent(components, 'postal_code');
      const country = this.findComponent(components, 'country');

      return {
        latitude: result.geometry.location.lat,
        longitude: result.geometry.location.lng,
        formattedAddress: result.formatted_address,
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
    if (!this.apiKey) {
      logger.error('Google Maps API key not configured');
      return [];
    }

    try {
      const response = await mapsClient.placesNearby({
        params: {
          location: { lat: latitude, lng: longitude },
          radius,
          keyword: query || 'parking',
          key: this.apiKey
        }
      });

      if (!response.data.results || response.data.results.length === 0) {
        return [];
      }

      return response.data.results.map((place) => ({
        name: place.name || '',
        address: place.vicinity || '',
        latitude: place.geometry?.location.lat || 0,
        longitude: place.geometry?.location.lng || 0,
        placeId: place.place_id || '',
        types: place.types || []
      }));
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
    if (!this.apiKey) {
      logger.error('Google Maps API key not configured');
      return null;
    }

    try {
      const response = await mapsClient.distancematrix({
        params: {
          origins: [`${origin.lat},${origin.lng}`],
          destinations: [`${destination.lat},${destination.lng}`],
          key: this.apiKey
        }
      });

      const element = response.data.rows[0].elements[0];

      if (element.status !== 'OK') {
        logger.warn('Distance calculation failed');
        return null;
      }

      return {
        distance: element.distance.value, // en metros
        duration: element.duration.value  // en segundos
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

  private findComponent(components: any[], type: string): string | undefined {
    const component = components.find((c: any) => c.types.includes(type));
    return component?.long_name;
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }
}

export default new GoogleMapsService();