import { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  title?: string;
  className?: string;
  footer?: ReactNode;
  headerActions?: ReactNode;
}

const Card = ({ children, title, className = '', footer, headerActions }: CardProps) => {
  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden ${className}`}>
      {title && (
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h3 className="text-lg font-medium text-gray-800">{title}</h3>
          {headerActions && <div>{headerActions}</div>}
        </div>
      )}
      <div className="p-6">{children}</div>
      {footer && (
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">{footer}</div>
      )}
    </div>
  );
};

export default Card;