import { getSupabaseBucket, getSupabaseClient } from '../supabase.client';

export async function uploadImagesToSupabase(
  files: Express.Multer.File[] | string[],
  folder = 'events',
): Promise<string[]> {
  const bucket = getSupabaseBucket();
  const urls: string[] = [];

  const supabase = getSupabaseClient();
  for (const file of files) {
    let fileBuffer: Buffer;
    let fileName: string;
    let contentType = 'application/octet-stream';

    if (typeof file === 'string') {
      // base64 string
      const base64Data = file.split(';base64,').pop();
      fileBuffer = Buffer.from(base64Data || '', 'base64');
      fileName = `${folder}/${Date.now()}-${Math.random().toString(36).substring(2, 8)}.jpg`;
      contentType = 'image/jpeg';
    } else {
      fileBuffer = file.buffer;
      fileName = `${folder}/${Date.now()}-${file.originalname}`;
      contentType = file.mimetype || 'application/octet-stream';
    }

    const { error } = await supabase.storage
      .from(bucket)
      .upload(fileName, fileBuffer, {
        contentType,
        upsert: true,
      });
    if (error) {
      throw new Error(`Supabase upload failed for ${fileName}: ${error.message}`);
    }
    const { data: publicUrl } = supabase.storage
      .from(bucket)
      .getPublicUrl(fileName);
    urls.push(publicUrl.publicUrl);
  }
  return urls;
}
