// src/services/maps.service.ts
import mapsRepository from '@/repositories/maps.repository';
import logger from '@/utils/logger';

export class MapsService {

  /**
   * Geocodificar dirección
   */
  async geocodeAddress(address: string) {
    // Validar entrada
    if (!address || address.trim().length === 0) {
      throw new Error('La dirección no puede estar vacía');
    }

    if (address.length < 3) {
      throw new Error('La dirección debe tener al menos 3 caracteres');
    }

    try {
      const result = await mapsRepository.geocodeAddress(address.trim());

      if (!result) {
        throw new Error('No se pudo geocodificar la dirección');
      }

      logger.info(`Address geocoded: ${address} -> (${result.latitude}, ${result.longitude})`);

      return result;
    } catch (error) {
      logger.error('Error geocoding address:', error);
      throw error;
    }
  }

  /**
   * Geocodificación inversa
   */
  async reverseGeocode(latitude: number, longitude: number) {
    // Validar coordenadas
    if (latitude < -90 || latitude > 90) {
      throw new Error('Latitud inválida. Debe estar entre -90 y 90');
    }

    if (longitude < -180 || longitude > 180) {
      throw new Error('Longitud inválida. Debe estar entre -180 y 180');
    }

    try {
      const result = await mapsRepository.reverseGeocode(latitude, longitude);

      if (!result) {
        throw new Error('No se pudo obtener la dirección para las coordenadas proporcionadas');
      }

      logger.info(`Coordinates reverse geocoded: (${latitude}, ${longitude}) -> ${result.formattedAddress}`);

      return result;
    } catch (error) {
      logger.error('Error reverse geocoding:', error);
      throw error;
    }
  }

  /**
   * Buscar lugares cercanos
   */
  async searchNearbyPlaces(
    latitude: number,
    longitude: number,
    radius: number = 1000,
    query?: string
  ) {
    // Validar coordenadas
    if (latitude < -90 || latitude > 90) {
      throw new Error('Latitud inválida');
    }

    if (longitude < -180 || longitude > 180) {
      throw new Error('Longitud inválida');
    }

    // Validar radio
    if (radius < 100) {
      throw new Error('El radio mínimo es 100 metros');
    }

    if (radius > 50000) {
      throw new Error('El radio máximo es 50,000 metros (50 km)');
    }

    try {
      const places = await mapsRepository.searchNearbyPlaces(
        latitude,
        longitude,
        radius,
        query
      );

      logger.info(`Found ${places.length} places near (${latitude}, ${longitude}) within ${radius}m`);

      return places;
    } catch (error) {
      logger.error('Error searching nearby places:', error);
      throw error;
    }
  }

  /**
   * Calcular distancia entre dos puntos
   */
  async getDistance(
    origin: { lat: number; lng: number },
    destination: { lat: number; lng: number }
  ) {
    // Validar origen
    if (origin.lat < -90 || origin.lat > 90 || origin.lng < -180 || origin.lng > 180) {
      throw new Error('Coordenadas de origen inválidas');
    }

    // Validar destino
    if (destination.lat < -90 || destination.lat > 90 || destination.lng < -180 || destination.lng > 180) {
      throw new Error('Coordenadas de destino inválidas');
    }

    try {
      const result = await mapsRepository.getDistance(origin, destination);

      if (!result) {
        throw new Error('No se pudo calcular la distancia');
      }

      logger.info(
        `Distance calculated: (${origin.lat}, ${origin.lng}) -> (${destination.lat}, ${destination.lng}): ${result.distance}m`
      );

      return {
        distance: {
          meters: result.distance,
          kilometers: parseFloat((result.distance / 1000).toFixed(2))
        },
        duration: {
          seconds: result.duration,
          minutes: Math.ceil(result.duration / 60),
          formatted: this.formatDuration(result.duration)
        }
      };
    } catch (error) {
      logger.error('Error calculating distance:', error);
      throw error;
    }
  }

  /**
   * Validar dirección
   */
  async validateAddress(address: string) {
    // Validar entrada
    if (!address || address.trim().length === 0) {
      throw new Error('La dirección no puede estar vacía');
    }

    if (address.length < 3) {
      throw new Error('La dirección debe tener al menos 3 caracteres');
    }

    try {
      const isValid = await mapsRepository.validateAddress(address.trim());

      logger.info(`Address validation: ${address} -> ${isValid ? 'valid' : 'invalid'}`);

      return {
        address: address.trim(),
        isValid,
        message: isValid ? 'Dirección válida' : 'Dirección no encontrada'
      };
    } catch (error) {
      logger.error('Error validating address:', error);
      throw error;
    }
  }

  /**
   * Obtener configuración del servicio de mapas
   */
  async getConfiguration() {
    const { config } = await import('@/config/environment');

    return {
      provider: mapsRepository.getProviderName(),
      isConfigured: mapsRepository.isConfigured(),
      defaultZoom: config.maps.defaultZoom,
      defaultRadius: config.maps.defaultRadius,
      // Solo enviar token en desarrollo para Mapbox (es seguro para client-side)
      ...(config.app.env === 'development' &&
        mapsRepository.getProviderName() === 'mapbox' && {
          mapboxToken: config.maps.mapboxToken
        })
    };
  }

  /**
   * Helper: Formatear duración
   */
  private formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours > 0) {
      return `${hours}h ${minutes}min`;
    }

    return `${minutes}min`;
  }
}

export default new MapsService();