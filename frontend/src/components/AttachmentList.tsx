import { useEffect, useRef, useState } from 'react';
import { attachmentsApi } from '../api';
import { getFulfilErrorMessage } from '../types';
import type { Attachment } from '../types';

interface AttachmentListProps {
  contentType: 'PO' | 'ORDER' | 'DELIVERY';
  objectId: number;
  readOnly?: boolean;
}

/** Format bytes into a human-readable string. */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${String(bytes)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Return an emoji icon based on attachment type. */
function getFileIcon(attachment: Attachment): string {
  if (attachment.is_pdf) return '📄';
  if (attachment.is_image) return '🖼️';
  if (attachment.is_spreadsheet) return '📊';
  return '📎';
}

/** Displays and manages file attachments for a PO, Order, or Delivery. */
export function AttachmentList({
  contentType,
  objectId,
  readOnly = false,
}: AttachmentListProps): React.JSX.Element {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    void loadAttachments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentType, objectId]);

  const loadAttachments = async (): Promise<void> => {
    try {
      setLoading(true);
      const data = await attachmentsApi.list(contentType, objectId);
      setAttachments(data);
      setError('');
    } catch {
      setError('Failed to load attachments');
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      await attachmentsApi.upload(contentType, objectId, file);
      await loadAttachments();
      setError('');
      event.target.value = '';
    } catch (err: unknown) {
      setError(getFulfilErrorMessage(err, 'Failed to upload file'));
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: number): Promise<void> => {
    if (!window.confirm('Are you sure you want to delete this attachment?')) return;

    try {
      await attachmentsApi.delete(id);
      await loadAttachments();
      setError('');
    } catch (err: unknown) {
      setError(getFulfilErrorMessage(err, 'Failed to delete attachment'));
    }
  };

  return (
    <div className="rounded-lg bg-white p-6 shadow">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold">Attachments</h2>
        {!readOnly && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={(e) => void handleUpload(e)}
              disabled={uploading}
            />
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              className="rounded bg-gray-200 px-4 py-2 font-medium text-gray-800 transition-colors hover:bg-gray-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {uploading ? 'Uploading...' : 'Upload File'}
            </button>
          </>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded border border-red-200 bg-red-50 px-4 py-3 text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-4 text-center">Loading...</div>
      ) : attachments.length === 0 ? (
        <div className="py-4 text-center text-gray-500">No attachments</div>
      ) : (
        <div className="space-y-2">
          {attachments.map((attachment) => (
            <div
              key={attachment.id}
              className="flex items-center justify-between rounded border border-gray-200 p-3 hover:bg-gray-50"
            >
              <div className="flex flex-1 items-center space-x-3">
                <span className="text-2xl">{getFileIcon(attachment)}</span>
                <div className="min-w-0 flex-1">
                  <a
                    href={attachment.file}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block truncate font-medium text-blue-600 hover:underline"
                  >
                    {attachment.filename}
                  </a>
                  <div className="text-xs text-gray-500">
                    {formatFileSize(attachment.file_size)} •{' '}
                    {new Date(attachment.uploaded_at).toLocaleDateString()}
                  </div>
                </div>
              </div>
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => void handleDelete(attachment.id)}
                  className="ml-2 text-red-600 hover:text-red-800"
                  title="Delete attachment"
                >
                  🗑️
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
