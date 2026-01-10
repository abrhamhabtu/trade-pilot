import React, { useEffect } from 'react';
import { CheckCircle, XCircle, AlertCircle, X } from 'lucide-react';
import clsx from 'clsx';

export type ToastType = 'success' | 'error' | 'info';

interface ToastProps {
  id: string;
  message: string;
  type: ToastType;
  onClose: (id: string) => void;
}

export const Toast: React.FC<ToastProps> = ({ id, message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose(id);
    }, 4000);

    return () => clearTimeout(timer);
  }, [id, onClose]);

  const icons = {
    success: CheckCircle,
    error: XCircle,
    info: AlertCircle
  };

  const colors = {
    success: {
      bg: 'bg-[#3BF68A]/20',
      border: 'border-[#3BF68A]/50',
      icon: 'text-[#3BF68A]'
    },
    error: {
      bg: 'bg-[#F45B69]/20',
      border: 'border-[#F45B69]/50',
      icon: 'text-[#F45B69]'
    },
    info: {
      bg: 'bg-[#A78BFA]/20',
      border: 'border-[#A78BFA]/50',
      icon: 'text-[#A78BFA]'
    }
  };

  const Icon = icons[type];
  const colorClasses = colors[type];

  return (
    <div
      className={clsx(
        'flex items-center space-x-3 px-4 py-3 rounded-lg border shadow-lg backdrop-blur-sm',
        'animate-slide-in',
        colorClasses.bg,
        colorClasses.border
      )}
      style={{
        animation: 'slideIn 0.3s ease-out'
      }}
    >
      <Icon className={clsx('h-5 w-5 flex-shrink-0', colorClasses.icon)} />
      <p className="text-[#E5E7EB] text-sm flex-1">{message}</p>
      <button
        onClick={() => onClose(id)}
        className="text-[#8B94A7] hover:text-[#E5E7EB] transition-colors"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};

// Toast Container - renders all active toasts
interface ToastContainerProps {
  toasts: Array<{ id: string; message: string; type: ToastType }>;
  onClose: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onClose }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col space-y-2">
      {toasts.map(toast => (
        <Toast
          key={toast.id}
          id={toast.id}
          message={toast.message}
          type={toast.type}
          onClose={onClose}
        />
      ))}
    </div>
  );
};
