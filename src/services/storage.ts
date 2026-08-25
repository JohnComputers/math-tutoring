/**
 * Firebase Storage — currently just the profile photo.
 *
 * Images are downscaled and re-encoded in the browser before upload. A phone camera
 * produces 4-6 MB files, and shipping one of those to every visitor of a mobile-first
 * site would undo most of the performance work elsewhere. Resizing client-side also
 * means Storage never holds the original, so there is less to pay for and less to leak.
 */

import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytesResumable,
} from 'firebase/storage';
import { storage } from '@/firebase/config';
import { logError } from '@/utils/errors';

/** Formats a browser can reliably decode into a canvas. */
export const ACCEPTED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
] as const;

/** Pre-compression ceiling. Anything larger is almost certainly a mistake. */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/** Longest edge after downscaling. Comfortably sharp on a 2x display portrait. */
const MAX_DIMENSION = 1000;
const JPEG_QUALITY = 0.85;

export interface UploadProgress {
  /** 0-100. */
  percent: number;
  bytesTransferred: number;
  totalBytes: number;
}

export interface UploadResult {
  downloadUrl: string;
  storagePath: string;
  bytes: number;
}

export class ImageValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ImageValidationError';
  }
}

/** Reject unsupported or oversized files before any work happens. */
export function validateImageFile(file: File): void {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type as (typeof ACCEPTED_IMAGE_TYPES)[number])) {
    throw new ImageValidationError(
      'Please choose a JPEG, PNG, WebP or GIF image.',
    );
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    const mb = (MAX_UPLOAD_BYTES / 1024 / 1024).toFixed(0);
    throw new ImageValidationError(`That image is too large. Please keep it under ${mb} MB.`);
  }
  if (file.size === 0) {
    throw new ImageValidationError('That file appears to be empty.');
  }
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new ImageValidationError('That file could not be read as an image.'));
    };
    image.src = url;
  });
}

/**
 * Downscale to `MAX_DIMENSION` on the longest edge and re-encode as JPEG.
 *
 * Falls back to the original file whenever compression would not help — an already-small
 * image, an animated GIF (a canvas would flatten it to one frame), or a canvas failure.
 */
async function compressImage(file: File): Promise<{ blob: Blob; extension: string }> {
  if (file.type === 'image/gif') {
    return { blob: file, extension: 'gif' };
  }

  try {
    const image = await loadImage(file);
    const scale = Math.min(1, MAX_DIMENSION / Math.max(image.width, image.height));

    // Nothing to gain: already small in both dimensions and in bytes.
    if (scale === 1 && file.size < 400 * 1024) {
      return { blob: file, extension: file.type === 'image/png' ? 'png' : 'jpg' };
    }

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(image.width * scale);
    canvas.height = Math.round(image.height * scale);

    const context = canvas.getContext('2d');
    if (!context) return { blob: file, extension: 'jpg' };

    // White matte: a transparent PNG flattened onto nothing renders black in JPEG.
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY);
    });

    if (!blob || blob.size >= file.size) {
      return { blob: file, extension: file.type === 'image/png' ? 'png' : 'jpg' };
    }
    return { blob, extension: 'jpg' };
  } catch (error) {
    logError('storage.compressImage', error);
    return { blob: file, extension: 'jpg' };
  }
}

/**
 * Upload a profile photo and return its public URL.
 *
 * The filename carries a timestamp so replacing the photo produces a new URL, rather
 * than a stale CDN copy of the old one.
 */
export async function uploadProfilePhoto(
  file: File,
  onProgress?: (progress: UploadProgress) => void,
): Promise<UploadResult> {
  validateImageFile(file);

  const { blob, extension } = await compressImage(file);
  const storagePath = `public/profile/photo-${Date.now()}.${extension}`;
  const storageRef = ref(storage(), storagePath);

  const task = uploadBytesResumable(storageRef, blob, {
    contentType: blob.type || 'image/jpeg',
    // Long cache: the filename changes on every replacement, so this is always safe.
    cacheControl: 'public, max-age=31536000, immutable',
  });

  await new Promise<void>((resolve, reject) => {
    task.on(
      'state_changed',
      (snapshot) => {
        onProgress?.({
          percent: snapshot.totalBytes
            ? Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100)
            : 0,
          bytesTransferred: snapshot.bytesTransferred,
          totalBytes: snapshot.totalBytes,
        });
      },
      (error) => reject(error),
      () => resolve(),
    );
  });

  const downloadUrl = await getDownloadURL(storageRef);
  return { downloadUrl, storagePath, bytes: blob.size };
}

/**
 * Delete a previously uploaded object.
 *
 * Best-effort: a failure here is logged, never surfaced. The new photo is already live,
 * and blocking on tidying up the old one would turn a successful upload into an error.
 */
export async function deleteStorageObject(storagePath: string): Promise<void> {
  if (!storagePath) return;
  try {
    await deleteObject(ref(storage(), storagePath));
  } catch (error) {
    logError('storage.deleteStorageObject', error);
  }
}

/** Human-readable file size for the upload UI. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
