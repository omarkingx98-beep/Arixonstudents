import React from 'react';
import { getPresetSvg } from '../lib/avatarService';

export interface UserAvatarProps {
  avatar?: string | null;
  name?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number;
  className?: string;
  border?: boolean;
  alt?: string;
  onClick?: () => void;
}

const SIZE_MAP: Record<string, { container: string; text: string; px: number }> = {
  xs: { container: 'w-6 h-6', text: 'text-[10px]', px: 24 },
  sm: { container: 'w-8 h-8', text: 'text-xs', px: 32 },
  md: { container: 'w-10 h-10', text: 'text-sm font-bold', px: 40 },
  lg: { container: 'w-12 h-12', text: 'text-base font-bold', px: 48 },
  xl: { container: 'w-24 h-24 sm:w-28 sm:h-28', text: 'text-2xl font-black', px: 112 },
};

// Consistent background gradient based on student's name
function getInitialColor(name?: string | null): string {
  if (!name) return 'bg-gradient-to-br from-blue-600 to-indigo-700 text-white';
  const colors = [
    'bg-gradient-to-br from-blue-600 to-indigo-700 text-white',
    'bg-gradient-to-br from-emerald-600 to-teal-700 text-white',
    'bg-gradient-to-br from-purple-600 to-pink-700 text-white',
    'bg-gradient-to-br from-amber-600 to-orange-700 text-white',
    'bg-gradient-to-br from-rose-600 to-red-700 text-white',
    'bg-gradient-to-br from-cyan-600 to-blue-700 text-white',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % colors.length;
  return colors[index];
}

export const UserAvatar: React.FC<UserAvatarProps> = ({
  avatar,
  name,
  size = 'md',
  className = '',
  border = true,
  alt = 'صورة المستخدم',
  onClick,
}) => {
  const [imgError, setImgError] = React.useState(false);

  // Size styling
  const sizeConfig = typeof size === 'string' ? SIZE_MAP[size] || SIZE_MAP.md : null;
  const styleObj = typeof size === 'number' ? { width: size, height: size } : undefined;

  // Initial letter
  const firstLetter = (name || 'ط').trim().charAt(0).toUpperCase();

  const borderClass = border ? 'border border-slate-200/90 dark:border-slate-700/80' : '';
  const roundedClass = size === 'xl' ? 'rounded-3xl' : 'rounded-2xl';

  // 1. Preset SVG avatar
  if (avatar && avatar.startsWith('preset:')) {
    const svgContent = getPresetSvg(avatar);
    if (svgContent) {
      return (
        <div
          onClick={onClick}
          style={styleObj}
          className={`${sizeConfig?.container || ''} ${roundedClass} ${borderClass} overflow-hidden shrink-0 flex items-center justify-center bg-slate-100 dark:bg-slate-800 shadow-2xs select-none ${className}`}
          dangerouslySetInnerHTML={{ __html: svgContent }}
          title={alt}
        />
      );
    }
  }

  // 2. Custom photo (data URL or external URL)
  if (avatar && !imgError && (avatar.startsWith('data:image/') || avatar.startsWith('http://') || avatar.startsWith('https://'))) {
    return (
      <img
        src={avatar}
        alt={alt}
        loading="lazy"
        onError={() => setImgError(true)}
        onClick={onClick}
        style={styleObj}
        className={`${sizeConfig?.container || ''} ${roundedClass} ${borderClass} object-cover shrink-0 bg-slate-100 dark:bg-slate-800 shadow-2xs ${className}`}
      />
    );
  }

  // 3. Fallback Initial Letter avatar
  const colorClass = getInitialColor(name);
  return (
    <div
      onClick={onClick}
      style={styleObj}
      className={`${sizeConfig?.container || ''} ${sizeConfig?.text || 'text-sm font-bold'} ${roundedClass} ${borderClass} ${colorClass} shrink-0 flex items-center justify-center shadow-2xs select-none font-['Plus_Jakarta_Sans',sans-serif] ${className}`}
      title={name || alt}
    >
      <span>{firstLetter}</span>
    </div>
  );
};
