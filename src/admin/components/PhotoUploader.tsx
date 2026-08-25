import { type ChangeEvent, useRef, useState } from 'react';
import {
  ACCEPTED_IMAGE_TYPES,
  ImageValidationError,
  MAX_UPLOAD_BYTES,
  deleteStorageObject,
  formatBytes,
  uploadProfilePhoto,
  validateImageFile,
} from '@/services/storage';
import { handleError } from '@/utils/errors';
import { Alert } from '@/components/ui/Feedback';
import { Icon } from '@/components/ui/Icon';

/**
 * Profile-photo uploader.
 *
 * Behaviour worth noting:
 *   - a local preview appears the instant a file is chosen, before the upload starts, so
 *     the admin can see they picked the right image;
 *   - progress is a real percentage from the resumable upload task, not a fake animation;
 *   - the previous Storage object is deleted only *after* the new URL is saved, so a
 *     failed upload never leaves the site with no photo at all.
 */

interface PhotoUploaderProps {
  currentUrl: string;
  currentPath: string;
  altText: string;
  onAltChange: (alt: string) => void;
  /** Called with the new download URL and storage path once the upload succeeds. */
  onUploaded: (url: string, storagePath: string) => void;
  onRemoved: () => void;
}

export function PhotoUploader({
  currentUrl,
  currentPath,
  altText,
  onAltChange,
  onUploaded,
  onRemoved,
}: PhotoUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const reset = () => {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setProgress(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError(null);
    setInfo(null);

    try {
      validateImageFile(file);
    } catch (caught) {
      setError(
        caught instanceof ImageValidationError
          ? caught.message
          : 'That file could not be used.',
      );
      if (inputRef.current) inputRef.current.value = '';
      return;
    }

    // Immediate local preview — no waiting on the network to see the choice.
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);
    setProgress(0);

    const previousPath = currentPath;

    try {
      const result = await uploadProfilePhoto(file, (p) => setProgress(p.percent));
      onUploaded(result.downloadUrl, result.storagePath);
      setInfo(
        `Uploaded — ${formatBytes(result.bytes)} after resizing (original was ${formatBytes(file.size)}). Remember to save.`,
      );

      // Tidy up the old object last, and only if it is genuinely a different file.
      if (previousPath && previousPath !== result.storagePath) {
        void deleteStorageObject(previousPath);
      }
    } catch (caught) {
      setError(
        handleError(
          'PhotoUploader.upload',
          caught,
          'The upload failed. Check your connection and try again.',
        ),
      );
    } finally {
      reset();
    }
  };

  const displayUrl = preview ?? currentUrl;
  const uploading = progress !== null;

  return (
    <div className="photo-uploader">
      <div className="photo-uploader__preview">
        {displayUrl ? (
          <img src={displayUrl} alt={altText || 'Profile photo preview'} />
        ) : (
          <div className="photo-uploader__empty" aria-hidden="true">
            <Icon name="upload" size={28} />
            <span>No photo yet</span>
          </div>
        )}

        {uploading && (
          <div className="photo-uploader__progress" role="status" aria-live="polite">
            <div className="photo-uploader__bar">
              <div
                className="photo-uploader__bar-fill"
                style={{ width: `${progress}%` }}
                role="progressbar"
                aria-valuenow={progress}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Upload progress"
              />
            </div>
            <span>{progress}%</span>
          </div>
        )}
      </div>

      <div className="photo-uploader__controls">
        {error && <Alert tone="error">{error}</Alert>}
        {info && <Alert tone="success">{info}</Alert>}

        <input
          ref={inputRef}
          type="file"
          id="profile-photo-input"
          className="sr-only"
          accept={ACCEPTED_IMAGE_TYPES.join(',')}
          onChange={(event) => void handleChange(event)}
          disabled={uploading}
        />

        <div className="btn-row">
          <label
            htmlFor="profile-photo-input"
            className={`btn btn--primary ${uploading ? 'is-disabled' : ''}`.trim()}
            aria-disabled={uploading}
          >
            <Icon name="upload" size={17} />
            {currentUrl ? 'Replace photo' : 'Upload photo'}
          </label>

          {currentUrl && !uploading && (
            <button
              type="button"
              className="btn btn--ghost-dark"
              onClick={() => {
                if (currentPath) void deleteStorageObject(currentPath);
                onRemoved();
                setInfo('Photo removed. Remember to save.');
              }}
            >
              <Icon name="trash" size={17} />
              Remove
            </button>
          )}
        </div>

        <p className="admin-hint">
          JPEG, PNG, WebP or GIF, up to {formatBytes(MAX_UPLOAD_BYTES)}. Large images are
          resized to 1000px and re-compressed in your browser before uploading, so the
          site stays fast on phones. A portrait-shaped photo works best.
        </p>

        <label className="field">
          <span className="field__label">Photo description (alt text)</span>
          <input
            className="input"
            type="text"
            value={altText}
            onChange={(event) => onAltChange(event.target.value)}
            placeholder="e.g. John Williams, math tutor"
            maxLength={140}
          />
          <span className="field__hint">
            Read aloud by screen readers and shown if the image fails to load. Describe who
            is in the photo.
          </span>
        </label>
      </div>
    </div>
  );
}
