import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import AttachmentList from './AttachmentList';
import type { Attachment } from '../api/types';

vi.mock('../api/client', () => ({
  default: { get: vi.fn(), post: vi.fn(), delete: vi.fn() },
}));

import api from '../api/client';

const makeAttachment = (overrides: Partial<Attachment> = {}): Attachment => ({
  id: 1,
  content_type: 'PO',
  object_id: 1,
  file: 'http://example.com/file.pdf',
  filename: 'file.pdf',
  file_size: 2048,
  uploaded_at: '2026-01-01T00:00:00Z',
  uploaded_by_user_id: 'u1',
  file_extension: 'pdf',
  file_size_mb: 0.002,
  is_image: false,
  is_pdf: true,
  is_spreadsheet: false,
  ...overrides,
});

describe('AttachmentList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading then attachments', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { results: [makeAttachment()] } });
    render(<AttachmentList contentType="PO" objectId={1} />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('file.pdf')).toBeInTheDocument());
  });

  it('shows empty state', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { results: [] } });
    render(<AttachmentList contentType="PO" objectId={1} />);
    await waitFor(() => expect(screen.getByText('No attachments')).toBeInTheDocument());
  });

  it('shows error on load failure', async () => {
    vi.mocked(api.get).mockRejectedValue(new Error('fail'));
    render(<AttachmentList contentType="PO" objectId={1} />);
    await waitFor(() => expect(screen.getByText('Failed to load attachments')).toBeInTheDocument());
  });

  it('handles file upload', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { results: [] } });
    vi.mocked(api.post).mockResolvedValue({});
    render(<AttachmentList contentType="PO" objectId={1} />);
    await waitFor(() => expect(screen.getByText('No attachments')).toBeInTheDocument());

    const file = new File(['data'], 'test.pdf', { type: 'application/pdf' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => expect(api.post).toHaveBeenCalled());
  });

  it('handles upload with no file selected', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { results: [] } });
    render(<AttachmentList contentType="PO" objectId={1} />);
    await waitFor(() => expect(screen.getByText('No attachments')).toBeInTheDocument());

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [] } });
    expect(api.post).not.toHaveBeenCalled();
  });

  it('shows upload error', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { results: [] } });
    vi.mocked(api.post).mockRejectedValue({ response: { data: { detail: 'Too large' } } });
    render(<AttachmentList contentType="PO" objectId={1} />);
    await waitFor(() => expect(screen.getByText('No attachments')).toBeInTheDocument());

    const file = new File(['data'], 'big.pdf', { type: 'application/pdf' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(screen.getByText('Too large')).toBeInTheDocument());
  });

  it('handles delete with confirm', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { results: [makeAttachment()] } });
    vi.mocked(api.delete).mockResolvedValue({});
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<AttachmentList contentType="PO" objectId={1} />);
    await waitFor(() => expect(screen.getByText('file.pdf')).toBeInTheDocument());

    fireEvent.click(screen.getByTitle('Delete attachment'));
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/attachments/1/'));
  });

  it('cancels delete on confirm=false', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { results: [makeAttachment()] } });
    vi.spyOn(window, 'confirm').mockReturnValue(false);

    render(<AttachmentList contentType="PO" objectId={1} />);
    await waitFor(() => expect(screen.getByText('file.pdf')).toBeInTheDocument());

    fireEvent.click(screen.getByTitle('Delete attachment'));
    expect(api.delete).not.toHaveBeenCalled();
  });

  it('shows delete error', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { results: [makeAttachment()] } });
    vi.mocked(api.delete).mockRejectedValue(new Error('oops'));
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<AttachmentList contentType="PO" objectId={1} />);
    await waitFor(() => expect(screen.getByText('file.pdf')).toBeInTheDocument());

    fireEvent.click(screen.getByTitle('Delete attachment'));
    // getApiErrorMessage returns err.message for Error instances
    await waitFor(() => expect(screen.getByText('oops')).toBeInTheDocument());
  });

  it('formats file sizes correctly', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: {
        results: [
          makeAttachment({ id: 1, filename: 'tiny.txt', file_size: 500 }),
          makeAttachment({ id: 2, filename: 'medium.txt', file_size: 5120 }),
          makeAttachment({ id: 3, filename: 'large.txt', file_size: 2097152 }),
        ],
      },
    });
    render(<AttachmentList contentType="PO" objectId={1} />);
    await waitFor(() => expect(screen.getByText('tiny.txt')).toBeInTheDocument());
    expect(screen.getByText(/500 B/)).toBeInTheDocument();
    expect(screen.getByText(/5\.0 KB/)).toBeInTheDocument();
    expect(screen.getByText(/2\.0 MB/)).toBeInTheDocument();
  });

  it('shows correct file icons', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: {
        results: [
          makeAttachment({ id: 1, is_pdf: true, is_image: false, is_spreadsheet: false }),
          makeAttachment({ id: 2, is_pdf: false, is_image: true, is_spreadsheet: false }),
          makeAttachment({ id: 3, is_pdf: false, is_image: false, is_spreadsheet: true }),
          makeAttachment({ id: 4, is_pdf: false, is_image: false, is_spreadsheet: false }),
        ],
      },
    });
    render(<AttachmentList contentType="PO" objectId={1} />);
    await waitFor(() => expect(screen.getByText('📄')).toBeInTheDocument());
    expect(screen.getByText('🖼️')).toBeInTheDocument();
    expect(screen.getByText('📊')).toBeInTheDocument();
    expect(screen.getByText('📎')).toBeInTheDocument();
  });

  it('hides upload button and delete icons in readOnly mode', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { results: [makeAttachment()] } });
    render(<AttachmentList contentType="PO" objectId={1} readOnly />);
    await waitFor(() => expect(screen.getByText('file.pdf')).toBeInTheDocument());
    expect(screen.queryByText('Upload File')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Delete attachment')).not.toBeInTheDocument();
  });
});
