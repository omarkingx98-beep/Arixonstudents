import React from 'react';
import type { StaffRole } from '../types';
import { ROLE_CONFIGS } from '../lib/roleService';

interface RoleBadgeProps {
  role?: StaffRole | null;
  size?: 'sm' | 'md' | 'lg';
  showIconOnly?: boolean;
  showStudent?: boolean;
  className?: string;
}

export const RoleBadge: React.FC<RoleBadgeProps> = ({
  role,
  size = 'md',
  showIconOnly = false,
  showStudent = false,
  className = '',
}) => {
  if (!role || (role === 'student' && !showStudent)) {
    return null;
  }

  const config = ROLE_CONFIGS[role] || ROLE_CONFIGS.student;

  const sizeClasses = {
    sm: 'text-[11px] px-1.5 py-0.5 gap-1',
    md: 'text-xs px-2.5 py-0.5 gap-1.5',
    lg: 'text-sm px-3 py-1 gap-2',
  }[size];

  if (showIconOnly) {
    return (
      <span
        title={config.labelAr}
        aria-label={config.labelAr}
        className={`inline-flex items-center justify-center cursor-default select-none ${className}`}
      >
        <span className="text-base leading-none">{config.icon}</span>
      </span>
    );
  }

  return (
    <span
      title={config.description}
      className={`inline-flex items-center font-bold rounded-full border shadow-xs transition-colors duration-200 select-none ${config.badgeBg} ${config.badgeBorder} ${config.badgeText} ${sizeClasses} ${className}`}
    >
      <span className="text-sm leading-none" aria-hidden="true">
        {config.icon}
      </span>
      <span className="whitespace-nowrap">{config.labelAr}</span>
    </span>
  );
};

export default RoleBadge;
