import React from 'react';

interface LogoProps {
  className?: string;
  showTagline?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export const Logo: React.FC<LogoProps> = ({ 
  className = '', 
  showTagline = false,
  size = 'md' 
}) => {
  const iconSize = 
    size === 'sm' ? 'w-7 h-7' : 
    size === 'lg' ? 'w-11 h-11' : 
    size === 'xl' ? 'w-16 h-16' : 
    'w-9 h-9';
    
  const textSize = 
    size === 'sm' ? 'text-lg' : 
    size === 'lg' ? 'text-2xl' : 
    size === 'xl' ? 'text-3xl' : 
    'text-xl';

  return (
    <div className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      {/* Brand Icon: Single Source Official Arixon Logo Image */}
      <img
        src="/logo.png"
        alt="Arixon Logo"
        className={`${iconSize} rounded-xl object-cover shadow-sm transition-transform hover:scale-105 shrink-0 border border-slate-200/50 dark:border-slate-800/80`}
        onError={(e) => {
          // Graceful fallback to favicon if needed
          const target = e.currentTarget;
          if (target.src !== '/favicon-192x192.png') {
            target.src = '/favicon-192x192.png';
          }
        }}
      />

      {/* Wordmark */}
      <div className="flex flex-col">
        <div className="flex items-center gap-1.5">
          <span 
            className={`font-black tracking-tight ${textSize} font-['Plus_Jakarta_Sans',sans-serif] text-slate-900 dark:text-white leading-none`}
          >
            ARIXON
          </span>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
            2009
          </span>
        </div>
        {showTagline && (
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 leading-tight tracking-wide mt-0.5">
            Learn. Compete. Improve.
          </span>
        )}
      </div>
    </div>
  );
};
