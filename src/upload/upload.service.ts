import { Injectable } from '@nestjs/common';
import { v2 as cloudinary, UploadApiResponse, UploadApiErrorResponse } from 'cloudinary';
const streamifier = require('streamifier');

@Injectable()
export class UploadService {
  async uploadImage(
    file: Express.Multer.File,
    folder: string = 'movies',
  ): Promise<UploadApiResponse | UploadApiErrorResponse> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: `cinema/${folder}`,
          resource_type: 'auto',
          transformation: [
            { width: 1000, crop: 'limit' },
            { quality: 'auto:good' },
          ],
        },
        (error, result) => {
          if (error) return reject(error);
          resolve(result);
        },
      );

      streamifier.createReadStream(file.buffer).pipe(uploadStream);
    });
  }

  async deleteImage(publicId: string): Promise<any> {
    return cloudinary.uploader.destroy(publicId);
  }

  async uploadImages(files: Express.Multer.File[], folder: string = 'movies'): Promise<UploadApiResponse[]> {
    const uploadPromises = files.map(file => this.uploadImage(file, folder));
    const results = await Promise.all(uploadPromises);
    return results.filter((result): result is UploadApiResponse => 'public_id' in result);
  }
}
