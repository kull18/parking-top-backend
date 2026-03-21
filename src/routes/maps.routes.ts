// src/routes/maps.routes.ts
import { Router } from 'express';
import mapsController from '@/controllers/maps.controller';

const router = Router();

/**
 * POST /maps/geocode
 * Convertir dirección a coordenadas
 * Body: { address: string }
 */
router.post('/geocode', mapsController.geocode);

/**
 * POST /maps/reverse-geocode
 * Convertir coordenadas a dirección
 * Body: { latitude: number, longitude: number }
 */
router.post('/reverse-geocode', mapsController.reverseGeocode);

/**
 * GET /maps/search-nearby
 * Buscar lugares cercanos
 * Query: latitude, longitude, radius?, query?
 */
router.get('/search-nearby', mapsController.searchNearby);

/**
 * POST /maps/distance
 * Calcular distancia entre dos puntos
 * Body: { origin: {lat, lng}, destination: {lat, lng} }
 */
router.post('/distance', mapsController.getDistance);

/**
 * POST /maps/validate-address
 * Validar si una dirección existe
 * Body: { address: string }
 */
router.post('/validate-address', mapsController.validateAddress);

/**
 * GET /maps/config
 * Obtener configuración de mapas
 */
router.get('/config', mapsController.getConfig);

export default router;