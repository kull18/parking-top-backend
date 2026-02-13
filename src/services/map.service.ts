import googleMapsService from '@/integrations/google-maps.client';
import mapboxService from '@/integrations/mapbox.client';
import { config } from '@/config/environment';
import logger from '@/utils/logger';

export class MapService {
  private useProvider: 'google' | 'mapbox';

  constructor() {
    // Determinar qué proveedor usar basado en configuración
    this.useProvider = config.maps?.preferredProvider || 'google';
  }

  async geocodeAddress(address: string) {
    try {
      if (this.useProvider === 'google') {
        return await googleMapsService.geocodeAddress(address);
      } else {
        return await mapboxService.geocodeAddress(address);
      }
    } catch (error) {
      logger.error('Error geocoding address:', error);
      throw error;
    }
  }

  async reverseGeocode(latitude: number, longitude: number) {
    try {
      if (this.useProvider === 'google') {
        return await googleMapsService.reverseGeocode(latitude, longitude);
      } else {
        return await mapboxService.reverseGeocode(latitude, longitude);
      }
    } catch (error) {
      logger.error('Error reverse geocoding:', error);
      throw error;
    }
  }

  async getDistance(
    origin: { latitude: number; longitude: number },
    destination: { latitude: number; longitude: number }
  ) {
    try {
      if (this.useProvider === 'google') {
        return await googleMapsService.getDistance(
          `${origin.latitude},${origin.longitude}`,
          `${destination.latitude},${destination.longitude}`
        );
      } else {
        return await mapboxService.getDirections(
          [origin.longitude, origin.latitude],
          [destination.longitude, destination.latitude]
        );
      }
    } catch (error) {
      logger.error('Error getting distance:', error);
      throw error;
    }
  }

  async searchNearbyPlaces(
    latitude: number,
    longitude: number,
    radius: number = 5000,
    type?: string
  ) {
    try {
      // Implementación específica para búsqueda de lugares cercanos
      if (this.useProvider === 'google') {
        // Google Places API
        logger.info(`Searching nearby places using Google Maps`);
        // Implementar cuando sea necesario
      } else {
        // Mapbox Places API
        logger.info(`Searching nearby places using Mapbox`);
        // Implementar cuando sea necesario
      }
      
      return [];
    } catch (error) {
      logger.error('Error searching nearby places:', error);
      throw error;
    }
  }

  async validateCoordinates(latitude: number, longitude: number): Promise<boolean> {
    return (
      latitude >= -90 &&
      latitude <= 90 &&
      longitude >= -180 &&
      longitude <= 180
    );
  }

  calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371; // Radio de la Tierra en km
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) *
        Math.cos(this.toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c * 1000; // Convertir a metros
    
    return Math.round(distance);
  }

  private toRad(value: number): number {
    return (value * Math.PI) / 180;
  }
}

export default new MapService();