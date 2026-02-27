import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import Loading from './Loading';

describe('Loading', () => {
  it('renders spinner', () => {
    const { container } = render(<Loading />);
    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
  });
});
