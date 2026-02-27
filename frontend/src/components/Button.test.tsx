import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Button from './Button';

describe('Button', () => {
  it('renders children', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('defaults to type=button', () => {
    render(<Button>Go</Button>);
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button');
  });

  it('supports type=submit', () => {
    render(<Button type="submit">Send</Button>);
    expect(screen.getByRole('button')).toHaveAttribute('type', 'submit');
  });

  it('calls onClick', async () => {
    const handler = vi.fn();
    render(<Button onClick={handler}>Go</Button>);
    await userEvent.click(screen.getByRole('button'));
    expect(handler).toHaveBeenCalledOnce();
  });

  it('disabled state', () => {
    render(<Button disabled>Go</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('primary variant (default)', () => {
    render(<Button>Go</Button>);
    expect(screen.getByRole('button').className).toContain('bg-blue-600');
  });

  it('secondary variant', () => {
    render(<Button variant="secondary">Go</Button>);
    expect(screen.getByRole('button').className).toContain('bg-gray-200');
  });

  it('danger variant', () => {
    render(<Button variant="danger">Go</Button>);
    expect(screen.getByRole('button').className).toContain('bg-red-600');
  });

  it('applies custom className', () => {
    render(<Button className="extra">Go</Button>);
    expect(screen.getByRole('button').className).toContain('extra');
  });
});
