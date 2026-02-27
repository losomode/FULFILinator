import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FormField from './FormField';

describe('FormField', () => {
  it('renders text input by default', () => {
    render(<FormField label="Name" name="name" value="" onChange={vi.fn()} />);
    expect(screen.getByLabelText('Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toHaveAttribute('type', 'text');
  });

  it('renders textarea when type=textarea', () => {
    render(<FormField label="Notes" name="notes" type="textarea" value="" onChange={vi.fn()} />);
    expect(screen.getByLabelText('Notes').tagName).toBe('TEXTAREA');
  });

  it('shows required asterisk', () => {
    render(<FormField label="Name" name="name" value="" onChange={vi.fn()} required />);
    expect(screen.getByText('*')).toBeInTheDocument();
  });

  it('does not show asterisk when not required', () => {
    render(<FormField label="Name" name="name" value="" onChange={vi.fn()} />);
    expect(screen.queryByText('*')).not.toBeInTheDocument();
  });

  it('calls onChange', async () => {
    const handler = vi.fn();
    render(<FormField label="Name" name="name" value="" onChange={handler} />);
    await userEvent.type(screen.getByLabelText('Name'), 'a');
    expect(handler).toHaveBeenCalled();
  });

  it('renders placeholder', () => {
    render(<FormField label="Name" name="name" value="" onChange={vi.fn()} placeholder="Enter name" />);
    expect(screen.getByPlaceholderText('Enter name')).toBeInTheDocument();
  });

  it('renders number type', () => {
    render(<FormField label="Price" name="price" type="number" value={0} onChange={vi.fn()} />);
    expect(screen.getByLabelText('Price')).toHaveAttribute('type', 'number');
  });

  it('shows error message and red border', () => {
    render(<FormField label="Name" name="name" value="" onChange={vi.fn()} error="This field may not be blank." />);
    expect(screen.getByText('This field may not be blank.')).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toHaveClass('border-red-500');
  });

  it('does not show error when no error prop', () => {
    render(<FormField label="Name" name="name" value="" onChange={vi.fn()} />);
    expect(screen.getByLabelText('Name')).toHaveClass('border-gray-300');
    expect(screen.getByLabelText('Name')).not.toHaveClass('border-red-500');
  });
});
