// src/controllers/maps.controller.ts
import { Request, Response, NextFunction } from 'express';
import mapsService from '@/services/maps.service';
import { sendSuccess, sendError } from '@/utils/response';
import logger from '@/utils/logger';

export class MapsController {

  /**
   * Geocodificar dirección
   * POST /maps/geocode
   */
  async geocode(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { address } = req.body;

      if (!address) {
        sendError(res, 'MISSING_ADDRESS', 'Debe proporcionar una dirección', 400);
        return;
      }

      const result = await mapsService.geocodeAddress(address);

      sendSuccess(res, result);
    } catch (error: any) {
      logger.error('Error in geocode controller:', error);

      if (error.message.includes('no puede estar vacía') || error.message.includes('al menos 3')) {
        sendError(res, 'INVALID_ADDRESS', error.message, 400);
      } else if (error.message.includes('No se pudo geocodificar')) {
        sendError(res, 'GEOCODING_FAILED', error.message, 404);
      } else {
        next(error);
      }
    }
  }

  /**
   * Geocodificación inversa
   * POST /maps/reverse-geocode
   */
  async reverseGeocode(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { latitude, longitude } = req.body;

      if (latitude === undefined || longitude === undefined) {
        sendError(res, 'MISSING_COORDINATES', 'Debe proporcionar latitud y longitud', 400);
        return;
      }

      const result = await mapsService.reverseGeocode(
        parseFloat(latitude),
        parseFloat(longitude)
      );

      sendSuccess(res, result);
    } catch (error: any) {
      logger.error('Error in reverse geocode controller:', error);

      if (error.message.includes('inválida')) {
        sendError(res, 'INVALID_COORDINATES', error.message, 400);
      } else if (error.message.includes('No se pudo obtener')) {
        sendError(res, 'REVERSE_GEOCODING_FAILED', error.message, 404);
      } else {
        next(error);
      }
    }
  }

  /**
   * Buscar lugares cercanos
   * GET /maps/search-nearby
   */
  async searchNearby(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { latitude, longitude, radius, query } = req.query;

      if (!latitude || !longitude) {
        sendError(res, 'MISSING_COORDINATES', 'Debe proporcionar latitud y longitud', 400);
        return;
      }

      const places = await mapsService.searchNearbyPlaces(
        parseFloat(latitude as string),
        parseFloat(longitude as string),
        radius ? parseInt(radius as string) : 1000,
        query as string
      );

      sendSuccess(res, places);
    } catch (error: any) {
      logger.error('Error in search nearby controller:', error);

      if (error.message.includes('inválida') || error.message.includes('mínimo') || error.message.includes('máximo')) {
        sendError(res, 'INVALID_PARAMETERS', error.message, 400);
      } else {
        next(error);
      }
    }
  }

  /**
   * Calcular distancia
   * POST /maps/distance
   */
  async getDistance(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { origin, destination } = req.body;

      if (!origin || !destination) {
        sendError(res, 'MISSING_COORDINATES', 'Debe proporcionar origen y destino', 400);
        return;
      }

      if (!origin.lat || !origin.lng || !destination.lat || !destination.lng) {
        sendError(res, 'INVALID_FORMAT', 'Formato inválido. Use {lat, lng} para origen y destino', 400);
        return;
      }

      const result = await mapsService.getDistance(
        { lat: parseFloat(origin.lat), lng: parseFloat(origin.lng) },
        { lat: parseFloat(destination.lat), lng: parseFloat(destination.lng) }
      );

      sendSuccess(res, result);
    } catch (error: any) {
      logger.error('Error in distance controller:', error);

      if (error.message.includes('inválidas')) {
        sendError(res, 'INVALID_COORDINATES', error.message, 400);
      } else if (error.message.includes('No se pudo calcular')) {
        sendError(res, 'DISTANCE_CALCULATION_FAILED', error.message, 404);
      } else {
        next(error);
      }
    }
  }

  /**
   * Validar dirección
   * POST /maps/validate-address
   */
  async validateAddress(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { address } = req.body;

      if (!address) {
        sendError(res, 'MISSING_ADDRESS', 'Debe proporcionar una dirección', 400);
        return;
      }

      const result = await mapsService.validateAddress(address);

      sendSuccess(res, result);
    } catch (error: any) {
      logger.error('Error in validate address controller:', error);

      if (error.message.includes('no puede estar vacía') || error.message.includes('al menos 3')) {
        sendError(res, 'INVALID_ADDRESS', error.message, 400);
      } else {
        next(error);
      }
    }
  }

  /**
   * Obtener configuración
   * GET /maps/config
   */
  async getConfig(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const config = await mapsService.getConfiguration();

      sendSuccess(res, config);
    } catch (error) {
      logger.error('Error in get config controller:', error);
      next(error);
    }
  }
}

export default new MapsController();