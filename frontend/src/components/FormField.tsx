import React from 'react';

interface FormFieldProps {
  label: string;
  type?: 'text' | 'number' | 'date' | 'textarea';
  name: string;
  value: string | number;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  required?: boolean;
  placeholder?: string;
  error?: string;
}

const FormField: React.FC<FormFieldProps> = ({
  label,
  type = 'text',
  name,
  value,
  onChange,
  required = false,
  placeholder,
  error,
}) => {
  const baseClasses = 'w-full px-3 py-2 border rounded focus:outline-none focus:ring-2';
  const inputClasses = error
    ? `${baseClasses} border-red-500 focus:ring-red-500`
    : `${baseClasses} border-gray-300 focus:ring-blue-500`;

  return (
    <div className="mb-4">
      <label htmlFor={name} className="block text-sm font-medium text-gray-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {type === 'textarea' ? (
        <textarea
          id={name}
          name={name}
          value={value}
          onChange={onChange}
          required={required}
          placeholder={placeholder}
          className={inputClasses}
          rows={3}
        />
      ) : (
        <input
          id={name}
          name={name}
          type={type}
          value={value}
          onChange={onChange}
          required={required}
          placeholder={placeholder}
          className={inputClasses}
        />
      )}
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
};

export default FormField;
