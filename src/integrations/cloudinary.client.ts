import { v2 as cloudinary } from 'cloudinary';
import { config } from '@/config/environment';
import logger from '@/utils/logger';

cloudinary.config({
  cloud_name: config.cloudinary.cloudName,
  api_key: config.cloudinary.apiKey,
  api_secret: config.cloudinary.apiSecret
});

export class CloudinaryService {

  async uploadBuffer(
    buffer: Buffer,
    options?: {
      folder?: string;
      publicId?: string;
      width?: number;
      height?: number;
    }
  ): Promise<{ url: string; publicId: string; secureUrl: string }> {
    try {
      const result = await new Promise<any>((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: options?.folder ?? 'parking-top',
            public_id: options?.publicId,
            transformation: [
              { quality: 'auto', fetch_format: 'auto' },
              ...(options?.width || options?.height
                ? [{ width: options.width, height: options.height, crop: 'limit' }]
                : [])
            ]
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );
        uploadStream.end(buffer);
      });

      return {
        url: result.url,
        secureUrl: result.secure_url,
        publicId: result.public_id
      };
    } catch (error) {
      logger.error('Error uploading to Cloudinary:', error);
      throw error;
    }
  }

  async uploadFromUrl(
    imageUrl: string,
    options?: {
      folder?: string;
      publicId?: string;
    }
  ): Promise<{ url: string; publicId: string; secureUrl: string }> {
    try {
      const result = await cloudinary.uploader.upload(imageUrl, {
        folder: options?.folder ?? 'parking-top',
        public_id: options?.publicId,
        transformation: [{ quality: 'auto', fetch_format: 'auto' }]
      });

      return {
        url: result.url,
        secureUrl: result.secure_url,
        publicId: result.public_id
      };
    } catch (error) {
      logger.error('Error uploading URL to Cloudinary:', error);
      throw error;
    }
  }

  async deleteImage(publicId: string): Promise<void> {
    try {
      await cloudinary.uploader.destroy(publicId);
      logger.info(`Deleted image from Cloudinary: ${publicId}`);
    } catch (error) {
      logger.error('Error deleting from Cloudinary:', error);
      throw error;
    }
  }

  getOptimizedUrl(
    publicId: string,
    options?: {
      width?: number;
      height?: number;
      crop?: string;
    }
  ): string {
    return cloudinary.url(publicId, {
      fetch_format: 'auto',
      quality: 'auto',
      ...(options?.width && { width: options.width }),
      ...(options?.height && { height: options.height }),
      ...(options?.crop && { crop: options.crop }),
      secure: true
    });
  }

  extractPublicId(cloudinaryUrl: string): string {
    const parts = cloudinaryUrl.split('/');
    const uploadIndex = parts.indexOf('upload');
    const pathParts = parts.slice(uploadIndex + 2);
    const lastPart = pathParts[pathParts.length - 1];
    pathParts[pathParts.length - 1] = lastPart.split('.')[0];
    return pathParts.join('/');
  }
}

export default new CloudinaryService();