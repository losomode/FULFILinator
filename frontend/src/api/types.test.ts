import { describe, it, expect } from 'vitest';
import { getAxiosErrorData, getApiErrorMessage, getApiFieldErrors, isNotFoundError } from './types';

describe('getAxiosErrorData', () => {
  it('returns undefined for non-object', () => {
    expect(getAxiosErrorData('str')).toBeUndefined();
    expect(getAxiosErrorData(null)).toBeUndefined();
    expect(getAxiosErrorData(undefined)).toBeUndefined();
    expect(getAxiosErrorData(42)).toBeUndefined();
  });

  it('returns undefined when no response', () => {
    expect(getAxiosErrorData({})).toBeUndefined();
  });

  it('returns undefined when response is not object', () => {
    expect(getAxiosErrorData({ response: 'str' })).toBeUndefined();
  });

  it('returns undefined when data is not object', () => {
    expect(getAxiosErrorData({ response: { data: 'str' } })).toBeUndefined();
  });

  it('returns undefined when data is null', () => {
    expect(getAxiosErrorData({ response: { data: null } })).toBeUndefined();
  });

  it('returns data when valid', () => {
    expect(getAxiosErrorData({ response: { data: { detail: 'err' } } })).toEqual({ detail: 'err' });
  });
});

describe('getApiFieldErrors', () => {
  it('returns empty for non-axios error', () => {
    expect(getApiFieldErrors(new Error('oops'))).toEqual({});
  });

  it('extracts top-level string errors', () => {
    const err = { response: { data: { tracking_number: 'This field may not be blank.' } } };
    expect(getApiFieldErrors(err)).toEqual({ tracking_number: 'This field may not be blank.' });
  });

  it('extracts top-level array errors', () => {
    const err = { response: { data: { tracking_number: ['This field may not be blank.'] } } };
    expect(getApiFieldErrors(err)).toEqual({ tracking_number: 'This field may not be blank.' });
  });

  it('extracts nested line item errors', () => {
    const err = { response: { data: { line_items: [{}, { serial_number: ['Required.'] }] } } };
    expect(getApiFieldErrors(err)).toEqual({ 'line_items[1].serial_number': 'Required.' });
  });

  it('skips detail and error keys', () => {
    const err = { response: { data: { detail: 'Not found', error: 'Bad', name: 'Required' } } };
    expect(getApiFieldErrors(err)).toEqual({ name: 'Required' });
  });

  it('handles mixed top-level and nested errors', () => {
    const err = { response: { data: {
      tracking_number: ['Blank.'],
      line_items: [{ price_per_unit: ['Required.'] }],
    } } };
    expect(getApiFieldErrors(err)).toEqual({
      tracking_number: 'Blank.',
      'line_items[0].price_per_unit': 'Required.',
    });
  });
});

describe('getApiErrorMessage', () => {
  it('returns detail from response', () => {
    expect(getApiErrorMessage({ response: { data: { detail: 'Not found' } } }, 'fb')).toBe('Not found');
  });

  it('returns error from response', () => {
    expect(getApiErrorMessage({ response: { data: { error: 'Bad' } } }, 'fb')).toBe('Bad');
  });

  it('returns field-level error with field name', () => {
    const err = { response: { data: { tracking_number: ['This field may not be blank.'] } } };
    expect(getApiErrorMessage(err, 'fb')).toBe('tracking number: This field may not be blank.');
  });

  it('returns Error.message', () => {
    expect(getApiErrorMessage(new Error('oops'), 'fb')).toBe('oops');
  });

  it('returns fallback for unknown', () => {
    expect(getApiErrorMessage(42, 'fb')).toBe('fb');
  });
});

describe('isNotFoundError', () => {
  it('returns false for non-object', () => {
    expect(isNotFoundError('str')).toBe(false);
    expect(isNotFoundError(null)).toBe(false);
  });

  it('returns false when no response', () => {
    expect(isNotFoundError({})).toBe(false);
  });

  it('returns true for 404', () => {
    expect(isNotFoundError({ response: { status: 404 } })).toBe(true);
  });

  it('returns false for non-404', () => {
    expect(isNotFoundError({ response: { status: 500 } })).toBe(false);
  });

  it('returns false when status missing', () => {
    expect(isNotFoundError({ response: {} })).toBe(false);
  });
});
