// Browser-side upload helpers for Studio (chunked upload into the band's
// private bucket through our own API).

export async function api<T>(url: string, init: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const data = (await response.json().catch(() => ({}))) as T & {
    error?: string;
  };
  if (!response.ok) throw new Error(data.error ?? `HTTP ${response.status}`);
  return data;
}

/**
 * Uploads straight into the band's private storage through our own API, in
 * 10 MB chunks. The band never sees R2 or any Cloudflare account.
 */
/** Reads the track length from the file itself (null if the browser can't). */
function readDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const probe = new Audio();
    const done = (value: number | null) => {
      URL.revokeObjectURL(url);
      resolve(value);
    };
    probe.preload = "metadata";
    probe.onloadedmetadata = () =>
      done(Number.isFinite(probe.duration) ? Math.round(probe.duration) : null);
    probe.onerror = () => done(null);
    setTimeout(() => done(null), 5000);
    probe.src = url;
  });
}

export async function uploadFile(
  file: File,
  onProgress: (sent: number) => void,
  title?: string,
) {
  const durationSec = await readDuration(file);
  const { uploadId, partSize, partsTotal } = await api<{
    uploadId: string;
    partSize: number;
    partsTotal: number;
  }>("/api/studio/uploads", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      filename: file.name,
      title,
      contentType: file.type || "audio/mpeg",
      size: file.size,
      durationSec,
    }),
  });

  try {
    const parts: { partNumber: number; etag: string }[] = [];
    for (let n = 1; n <= partsTotal; n++) {
      const chunk = file.slice((n - 1) * partSize, n * partSize);
      parts.push(
        await api(`/api/studio/uploads/${uploadId}/parts/${n}`, {
          method: "PUT",
          body: chunk,
        }),
      );
      onProgress(Math.min(n * partSize, file.size));
    }
    return await api<{ trackId: string; title: string; size: number }>(
      `/api/studio/uploads/${uploadId}/complete`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parts }),
      },
    );
  } catch (error) {
    await fetch(`/api/studio/uploads/${uploadId}`, { method: "DELETE" }).catch(
      () => {},
    );
    throw error;
  }
}

/** Sorts files the way people expect: "2 x" before "10 x". */
export function naturalSort(files: File[]) {
  return [...files].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, {
      numeric: true,
      sensitivity: "base",
    }),
  );
}

/** "03 - Night Ferry.wav" → "Night Ferry" */
export function titleFromFilename(name: string) {
  return (
    name
      .replace(/\.[^.]+$/, "")
      .replace(/^\s*\d{1,3}\s*[-._)]?\s*/, "")
      .trim() || name
  );
}
