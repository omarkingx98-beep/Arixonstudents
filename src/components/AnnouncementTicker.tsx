import React, { useEffect, useState } from 'react';
import { Megaphone, Sparkles, X, ChevronLeft, ExternalLink } from 'lucide-react';
import { fetchActiveAnnouncements } from '../lib/announcementService';
import type { Announcement } from '../types';

export const AnnouncementTicker: React.FC = () => {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      const active = await fetchActiveAnnouncements();
      if (isMounted) {
        setAnnouncements(active);
      }
    };

    load();
    // Refresh periodically every 60 seconds to purge expired ones
    const interval = setInterval(load, 60000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  if (isDismissed || announcements.length === 0) {
    return null;
  }

  const tickerItems = announcements.length < 4
    ? [...announcements, ...announcements, ...announcements]
    : [...announcements, ...announcements];

  return (
    <>
      <div 
        id="announcement-ticker-bar"
        className="relative z-20 w-full bg-gradient-to-r from-amber-500/10 via-amber-500/15 to-blue-500/10 dark:from-amber-950/40 dark:via-amber-900/30 dark:to-blue-950/30 border-b border-amber-300/40 dark:border-amber-800/40 text-slate-800 dark:text-slate-200 text-xs py-2 px-3 sm:px-6 overflow-hidden flex items-center justify-between shadow-2xs backdrop-blur-xs"
      >
        <div className="flex items-center gap-2 shrink-0 pr-1 pl-2">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500 text-white shadow-xs animate-pulse">
            <Megaphone className="w-3 h-3" />
            <span>إعلان هام</span>
          </span>
        </div>

        {/* Marquee Container */}
        <div className="flex-1 overflow-hidden relative">
          <div className="inline-flex items-center whitespace-nowrap animate-marquee gap-8 hover:[animation-play-state:paused]">
            {tickerItems.map((ann, idx) => (
              <span
                key={`${ann.id || 'item'}_${idx}`}
                onClick={() => setSelectedAnnouncement(ann)}
                className="inline-flex items-center gap-2 cursor-pointer group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors"
              >
                <span className="font-bold text-amber-700 dark:text-amber-300">
                  {ann.title}:
                </span>
                <span className="text-slate-600 dark:text-slate-300">
                  {ann.content}
                </span>

                {ann.linkUrl && (
                  <a
                    href={ann.linkUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-[10px] font-bold border border-emerald-400/30 transition-all cursor-pointer"
                  >
                    <span>{ann.linkLabel || 'فتح الرابط'}</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                )}

                <ChevronLeft className="w-3.5 h-3.5 text-amber-500 inline" />
                <span className="text-amber-400/50">|</span>
              </span>
            ))}
          </div>
        </div>

        {/* Close Button */}
        <button
          onClick={() => setIsDismissed(true)}
          className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-black/5 dark:hover:bg-white/5 transition-colors shrink-0 mr-1"
          title="إخفاء الشريط"
          aria-label="إخفاء شريط الإعلانات"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Details Modal */}
      {selectedAnnouncement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white dark:bg-[#0c101c] w-full max-w-lg rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <Megaphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {selectedAnnouncement.title}
                  </h3>
                  <span className="text-[11px] text-slate-400">
                    نُشر بتاريخ {new Date(selectedAnnouncement.createdAt).toLocaleDateString('ar-EG')}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSelectedAnnouncement(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line py-2">
              {selectedAnnouncement.content}
            </div>

            {selectedAnnouncement.expiresAt && (
              <div className="text-[11px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 p-2.5 rounded-xl border border-amber-200/60 dark:border-amber-900/40">
                صالح حتى: {new Date(selectedAnnouncement.expiresAt).toLocaleString('ar-EG')}
              </div>
            )}

            {selectedAnnouncement.linkUrl && (
              <div className="pt-1">
                <a
                  href={selectedAnnouncement.linkUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm shadow-emerald-600/20 transition-all cursor-pointer"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>{selectedAnnouncement.linkLabel || 'فتح الرابط'}</span>
                </a>
              </div>
            )}

            <button
              onClick={() => setSelectedAnnouncement(null)}
              className="w-full py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 font-bold text-xs text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
            >
              إغلاق
            </button>
          </div>
        </div>
      )}
    </>
  );
};
