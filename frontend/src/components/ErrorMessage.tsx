import React from 'react';

interface ErrorMessageProps {
  message: string;
}

const ErrorMessage: React.FC<ErrorMessageProps> = ({ message }) => {
  return (
    <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
      <p className="font-medium">Error</p>
      <p>{message}</p>
    </div>
  );
};

export default ErrorMessage;
