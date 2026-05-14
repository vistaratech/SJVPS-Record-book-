import React from 'react';
import { 
  Hash, Calendar, ChevronDown, FlaskConical, ListOrdered, 
  IndianRupee, Phone, Mail, Globe, Star, CheckSquare, 
  Image as ImageIcon 
} from 'lucide-react';

export const TextIcon = ({ size }: { size?: number }) => (
  <span className="col-type-text-icon" style={size ? { width: size, height: size, fontSize: Math.max(9, size - 3), lineHeight: `${size}px` } : {}}>T</span>
);

export function getColumnIcon(type: string | undefined) {
  switch (type) {
    case 'number':         return Hash;
    case 'auto_increment': return ListOrdered;
    case 'currency':       return IndianRupee;
    case 'date':           return Calendar;
    case 'dropdown':       return ChevronDown;
    case 'formula':        return FlaskConical;
    case 'phone':          return Phone;
    case 'email':          return Mail;
    case 'url':            return Globe;
    case 'rating':         return Star;
    case 'checkbox':       return CheckSquare;
    case 'image':          return ImageIcon;
    default:               return TextIcon;
  }
}

interface ColumnIconProps {
  type: string | undefined;
  size?: number;
  className?: string;
}

export const ColumnIcon: React.FC<ColumnIconProps> = ({ type, size = 12, className }) => {
  const Icon = getColumnIcon(type);
  return <Icon size={size} className={className} />;
};
