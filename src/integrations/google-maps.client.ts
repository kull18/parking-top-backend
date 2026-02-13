import { Client } from '@googlemaps/google-maps-services-js';
import { config } from '@/config/environment';
import logger from '@/utils/logger';

const mapsClient = new Client({});

export class GoogleMapsService {
  
  async geocodeAddress(address: string) {
    try {
      const response = await mapsClient.geocode({
        params: {
          address,
          key: config.maps.googleApiKey
        }
      });

      if (response.data.results.length === 0) {
        throw new Error('No se encontró la dirección');
      }

      const result = response.data.results[0];
      
      return {
        latitude: result.geometry.location.lat,
        longitude: result.geometry.location.lng,
        formattedAddress: result.formatted_address,
        placeId: result.place_id
      };
    } catch (error) {
      logger.error('Error geocoding address:', error);
      throw error;
    }
  }

  async reverseGeocode(latitude: number, longitude: number) {
    try {
      const response = await mapsClient.reverseGeocode({
        params: {
          latlng: { lat: latitude, lng: longitude },
          key: config.maps.googleApiKey
        }
      });

      if (response.data.results.length === 0) {
        throw new Error('No se encontró la ubicación');
      }

      return {
        address: response.data.results[0].formatted_address,
        placeId: response.data.results[0].place_id
      };
    } catch (error) {
      logger.error('Error reverse geocoding:', error);
      throw error;
    }
  }

  async getDistance(origin: string, destination: string) {
    try {
      const response = await mapsClient.distancematrix({
        params: {
          origins: [origin],
          destinations: [destination],
          key: config.maps.googleApiKey
        }
      });

      const element = response.data.rows[0].elements[0];

      if (element.status !== 'OK') {
        throw new Error('No se pudo calcular la distancia');
      }

      return {
        distance: element.distance.value, // en metros
        duration: element.duration.value, // en segundos
        distanceText: element.distance.text,
        durationText: element.duration.text
      };
    } catch (error) {
      logger.error('Error calculating distance:', error);
      throw error;
    }
  }
}

export default new GoogleMapsService();