import { getEnv } from "@/lib/cf";

export type UploadRow = {
  id: string;
  band_id: string;
  r2_upload_id: string;
  r2_key: string;
  title: string;
  content_type: string;
  size_bytes: number;
  parts_total: number;
  duration_sec: number | null;
};

export async function getUpload(id: string, bandId: string) {
  const { DB } = await getEnv();
  return DB.prepare("SELECT * FROM uploads WHERE id = ?1 AND band_id = ?2")
    .bind(id, bandId)
    .first<UploadRow>();
}
