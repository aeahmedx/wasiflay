import type { SupabaseClient } from "@supabase/supabase-js";

export const BUCKET = "uploads";
export const MAX_DIMENSION = 1600;
export const JPEG_QUALITY = 0.8;
/** Hard ceiling before compression. A modern phone photo is 4–8MB. */
export const MAX_INPUT_BYTES = 25 * 1024 * 1024;

export class ImageTooLargeError extends Error {
  constructor() {
    super("IMAGE_TOO_LARGE");
    this.name = "ImageTooLargeError";
  }
}

export class ImageDecodeError extends Error {
  constructor() {
    super("IMAGE_DECODE_FAILED");
    this.name = "ImageDecodeError";
  }
}

/**
 * Compress in the browser before upload.
 *
 * This is not an optimisation, it's a requirement: thousands of people on
 * congested stadium cell service uploading 6MB originals would fail on
 * their end and cost a fortune on ours. 1600px at q0.8 lands around
 * 300–500KB and is indistinguishable on a phone.
 *
 * Canvas re-encoding also strips EXIF, which removes the GPS coordinates
 * phones embed in photos — worth having by default for a community where
 * some people have real privacy concerns.
 */
export async function compressImage(file: File): Promise<Blob> {
  if (file.size > MAX_INPUT_BYTES) throw new ImageTooLargeError();

  const bitmap = await createImageBitmap(file).catch(() => {
    throw new ImageDecodeError();
  });

  const scale = Math.min(
    1,
    MAX_DIMENSION / Math.max(bitmap.width, bitmap.height)
  );
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new ImageDecodeError();
  }

  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY)
  );
  if (!blob) throw new ImageDecodeError();
  return blob;
}

/** Dimensions of the compressed result, for reserving layout space. */
export async function measure(blob: Blob): Promise<{ w: number; h: number }> {
  const bitmap = await createImageBitmap(blob);
  const size = { w: bitmap.width, h: bitmap.height };
  bitmap.close();
  return size;
}

/**
 * A photo attached to a feed post.
 *
 * Same bucket and same policies as room photos — the upload policy
 * keys on the user id being the second path segment, so the shape of
 * this path matters and mirrors the room one deliberately.
 */
export async function uploadPostImage(
  client: SupabaseClient,
  userId: string,
  blob: Blob
): Promise<string> {
  const path = `posts/${userId}/${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}.jpg`;

  const { error } = await client.storage.from(BUCKET).upload(path, blob, {
    contentType: "image/jpeg",
    cacheControl: "31536000",
    upsert: false,
  });
  if (error) throw error;

  const { data } = client.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function uploadRoomImage(
  client: SupabaseClient,
  userId: string,
  roomId: string,
  blob: Blob
): Promise<string> {
  const path = `rooms/${roomId}/${userId}/${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}.jpg`;

  const { error } = await client.storage.from(BUCKET).upload(path, blob, {
    contentType: "image/jpeg",
    cacheControl: "31536000",
    upsert: false,
  });
  if (error) throw error;

  const { data } = client.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}


/**
 * Turns a public storage URL back into the object path so the file can
 * be deleted. Returns null for anything that isn't one of our uploads —
 * never guess at a path we didn't create.
 */
export function storagePathFromUrl(url: string | null): string | null {
  if (!url) return null;
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const i = url.indexOf(marker);
  if (i === -1) return null;
  const path = url.slice(i + marker.length).split("?")[0];
  return path.length > 0 ? decodeURIComponent(path) : null;
}

/**
 * Removes the underlying file. Deleting only the message row leaves the
 * image reachable by anyone holding the URL. Staff-only at the storage
 * policy level (0015).
 */
export async function deleteStoredImage(
  client: SupabaseClient,
  url: string | null
): Promise<void> {
  const path = storagePathFromUrl(url);
  if (!path) return;
  const { error } = await client.storage.from(BUCKET).remove([path]);
  if (error) throw error;
}
