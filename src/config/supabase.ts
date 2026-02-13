// Eliminar aws.ts completo y crear supabase.ts:
import { createClient } from '@supabase/supabase-js';
import { config } from './environment';
import logger from '@/utils/logger';

// Cliente con service role key para operaciones del servidor
export const supabase = createClient(
  config.supabase.url,
  config.supabase.serviceRoleKey
);

export const uploadImage = async (
  file: Buffer,
  fileName: string,
  mimeType: string
): Promise<string> => {
  const { data, error } = await supabase.storage
    .from(config.supabase.storageBucket)
    .upload(fileName, file, {
      contentType: mimeType,
      upsert: false
    });

  if (error) {
    logger.error('Error uploading image to Supabase:', error);
    throw new Error(`Error al subir imagen: ${error.message}`);
  }

  const { data: urlData } = supabase.storage
    .from(config.supabase.storageBucket)
    .getPublicUrl(data.path);

  return urlData.publicUrl;
};

export const deleteImage = async (fileName: string): Promise<void> => {
  const { error } = await supabase.storage
    .from(config.supabase.storageBucket)
    .remove([fileName]);

  if (error) {
    logger.error('Error deleting image from Supabase:', error);
    throw new Error(`Error al eliminar imagen: ${error.message}`);
  }
};

logger.info('Supabase client configured');

export default supabase;