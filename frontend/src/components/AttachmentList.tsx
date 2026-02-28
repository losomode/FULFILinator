import React, { useEffect, useRef, useState } from 'react';
import { getApiErrorMessage, Attachment } from '../api/types';
import api from '../api/client';
import Button from './Button';

interface AttachmentListProps {
  contentType: 'PO' | 'ORDER' | 'DELIVERY';
  objectId: number;
  readOnly?: boolean;
}

const AttachmentList: React.FC<AttachmentListProps> = ({ contentType, objectId, readOnly = false }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadAttachments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentType, objectId]);

  const loadAttachments = async () => {
    try {
      setLoading(true);
      const response = await api.get<{ results: Attachment[] }>(
        `/attachments/?content_type=${contentType}&object_id=${objectId}`
      );
      setAttachments(response.data.results);
      setError('');
    } catch {
      setError('Failed to load attachments');
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('content_type', contentType);
    formData.append('object_id', objectId.toString());
    formData.append('file', file);

    try {
      setUploading(true);
      await api.post('/attachments/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      await loadAttachments();
      setError('');
      // Reset file input
      event.target.value = '';
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Failed to upload file'));
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this attachment?')) return;

    try {
      await api.delete(`/attachments/${id}/`);
      await loadAttachments();
      setError('');
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Failed to delete attachment'));
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (attachment: Attachment): string => {
    if (attachment.is_pdf) return '📄';
    if (attachment.is_image) return '🖼️';
    if (attachment.is_spreadsheet) return '📊';
    return '📎';
  };

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Attachments</h2>
        {!readOnly && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleUpload}
              disabled={uploading}
            />
            <Button
              variant="secondary"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? 'Uploading...' : 'Upload File'}
            </Button>
          </>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-4">Loading...</div>
      ) : attachments.length === 0 ? (
        <div className="text-gray-500 text-center py-4">No attachments</div>
      ) : (
        <div className="space-y-2">
          {attachments.map((attachment) => (
            <div
              key={attachment.id}
              className="flex items-center justify-between p-3 border border-gray-200 rounded hover:bg-gray-50"
            >
              <div className="flex items-center space-x-3 flex-1">
                <span className="text-2xl">{getFileIcon(attachment)}</span>
                <div className="flex-1 min-w-0">
                  <a
                    href={attachment.file}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline font-medium block truncate"
                  >
                    {attachment.filename}
                  </a>
                  <div className="text-xs text-gray-500">
                    {formatFileSize(attachment.file_size)} • 
                    {new Date(attachment.uploaded_at).toLocaleDateString()}
                  </div>
                </div>
              </div>
              {!readOnly && (
                <button
                  onClick={() => handleDelete(attachment.id)}
                  className="text-red-600 hover:text-red-800 ml-2"
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
};

export default AttachmentList;
