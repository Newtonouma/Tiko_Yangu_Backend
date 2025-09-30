import { getSupabaseClient } from '../supabase.client';

export async function uploadImagesToSupabase(files: Express.Multer.File[] | string[], folder = 'events'): Promise<string[]> {
  const bucket = process.env.SUPABASE_BUCKET;
  if (!bucket) throw new Error('SUPABASE_BUCKET not set');
  const urls: string[] = [];

  const supabase = getSupabaseClient();
  for (const file of files) {
    let fileBuffer: Buffer;
    let fileName: string;
    if (typeof file === 'string') {
      // base64 string
      const base64Data = file.split(';base64,').pop();
      fileBuffer = Buffer.from(base64Data!, 'base64');
      fileName = `${folder}/${Date.now()}-${Math.random().toString(36).substring(2, 8)}.jpg`;
    } else {
      fileBuffer = file.buffer;
      fileName = `${folder}/${Date.now()}-${file.originalname}`;
    }
    const { data, error } = await supabase.storage.from(bucket).upload(fileName, fileBuffer, {
      contentType: 'image/jpeg',
      upsert: true,
    });
    if (error) throw error;
    const { data: publicUrl } = supabase.storage.from(bucket).getPublicUrl(fileName);
    urls.push(publicUrl.publicUrl);
  }
  return urls;
}
