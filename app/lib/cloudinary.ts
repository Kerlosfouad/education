import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

export { cloudinary };

/**
 * Upload a file (buffer or base64 or file path) to Cloudinary
 * @param fileData base64 data string, URL or buffer
 * @param folder folder name inside Cloudinary
 * @param resourceType 'auto' | 'image' | 'raw' | 'video'
 */
export async function uploadToCloudinary(
  fileData: string,
  folder = 'assignments',
  resourceType: 'auto' | 'image' | 'raw' | 'video' = 'auto'
): Promise<{ url: string; public_id: string; format?: string }> {
  const result = await cloudinary.uploader.upload(fileData, {
    folder: `dr_emad_platform/${folder}`,
    resource_type: resourceType,
  });

  return {
    url: result.secure_url || result.url,
    public_id: result.public_id,
    format: result.format,
  };
}
