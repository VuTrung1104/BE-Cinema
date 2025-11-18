import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary, UploadApiResponse, UploadApiErrorResponse } from 'cloudinary';

@Injectable()
export class CloudinaryService {
  private readonly logger = new Logger(CloudinaryService.name);

  constructor(private configService: ConfigService) {
    cloudinary.config({
      cloud_name: this.configService.get<string>('CLOUDINARY_CLOUD_NAME'),
      api_key: this.configService.get<string>('CLOUDINARY_API_KEY'),
      api_secret: this.configService.get<string>('CLOUDINARY_API_SECRET'),
    });
  }

  async uploadImage(
    file: Express.Multer.File,
    folder: string = 'be-cinema/avatars',
  ): Promise<UploadApiResponse> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: folder,
          resource_type: 'image',
          transformation: [
            { width: 400, height: 400, crop: 'fill', gravity: 'face' },
            { quality: 'auto:good' },
            { fetch_format: 'auto' },
          ],
        },
        (error: UploadApiErrorResponse, result: UploadApiResponse) => {
          if (error) {
            this.logger.error('Cloudinary upload error:', error);
            return reject(error);
          }
          this.logger.log(`Image uploaded successfully: ${result.public_id}`);
          resolve(result);
        },
      );

      uploadStream.end(file.buffer);
    });
  }

  async deleteImage(publicId: string): Promise<boolean> {
    try {
      const result = await cloudinary.uploader.destroy(publicId);
      this.logger.log(`Image deleted: ${publicId}`);
      return result.result === 'ok';
    } catch (error) {
      this.logger.error(`Failed to delete image ${publicId}:`, error);
      return false;
    }
  }
}
