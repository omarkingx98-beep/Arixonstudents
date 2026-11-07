/**
 * Avatar Service & Preset Avatars (Part N)
 * High-performance client-side image compression & SVG presets without Firebase Storage
 */

export interface PresetAvatarItem {
  id: string; // e.g. 'preset:grad_cap_1'
  name: string;
  category: 'academic' | 'creative' | 'mascot';
  svg: string;
}

// 16 beautiful, crisp inline SVG preset avatars for Tawjihi students
export const PRESET_AVATARS: PresetAvatarItem[] = [
  {
    id: 'preset:student_grad_blue',
    name: 'طالب متفوق (كحلي)',
    category: 'academic',
    svg: `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="50" cy="50" r="50" fill="#1E3A8A"/>
      <circle cx="50" cy="46" r="22" fill="#FDE047"/>
      <path d="M50 20L72 32L50 44L28 32L50 20Z" fill="#0F172A"/>
      <path d="M72 32V42" stroke="#EAB308" stroke-width="2.5" stroke-linecap="round"/>
      <circle cx="72" cy="43" r="2" fill="#EAB308"/>
      <circle cx="43" cy="44" r="2.5" fill="#1E293B"/>
      <circle cx="57" cy="44" r="2.5" fill="#1E293B"/>
      <path d="M44 54C46 57 54 57 56 54" stroke="#1E293B" stroke-width="2" stroke-linecap="round"/>
      <path d="M22 88C22 72 34 68 50 68C66 68 78 72 78 88" fill="#2563EB"/>
    </svg>`,
  },
  {
    id: 'preset:student_grad_purple',
    name: 'طالبة متفوقة (بنفسجي)',
    category: 'academic',
    svg: `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="50" cy="50" r="50" fill="#6B21A8"/>
      <circle cx="50" cy="46" r="22" fill="#FED7AA"/>
      <path d="M50 20L72 32L50 44L28 32L50 20Z" fill="#3B0764"/>
      <path d="M72 32V42" stroke="#F43F5E" stroke-width="2.5" stroke-linecap="round"/>
      <circle cx="72" cy="43" r="2" fill="#F43F5E"/>
      <circle cx="43" cy="44" r="2.5" fill="#3B0764"/>
      <circle cx="57" cy="44" r="2.5" fill="#3B0764"/>
      <path d="M44 54C46 57 54 57 56 54" stroke="#3B0764" stroke-width="2" stroke-linecap="round"/>
      <path d="M22 88C22 72 34 68 50 68C66 68 78 72 78 88" fill="#9333EA"/>
    </svg>`,
  },
  {
    id: 'preset:scientist_green',
    name: 'عالم المستقبل (علمي)',
    category: 'academic',
    svg: `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="50" cy="50" r="50" fill="#065F46"/>
      <circle cx="50" cy="46" r="22" fill="#FEF08A"/>
      <path d="M28 38C28 38 36 24 50 24C64 24 72 38 72 38" stroke="#047857" stroke-width="6" stroke-linecap="round"/>
      <rect x="36" y="40" width="12" height="9" rx="3" stroke="#064E3B" stroke-width="2" fill="none"/>
      <rect x="52" y="40" width="12" height="9" rx="3" stroke="#064E3B" stroke-width="2" fill="none"/>
      <path d="M48 44H52" stroke="#064E3B" stroke-width="2"/>
      <path d="M45 55C47 57 53 57 55 55" stroke="#064E3B" stroke-width="2" stroke-linecap="round"/>
      <path d="M24 90C24 74 35 70 50 70C65 70 76 74 76 90" fill="#10B981"/>
      <path d="M50 70V90" stroke="#047857" stroke-width="2"/>
    </svg>`,
  },
  {
    id: 'preset:literature_book',
    name: 'أديب ومفكر (أدبي)',
    category: 'academic',
    svg: `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="50" cy="50" r="50" fill="#9A3412"/>
      <circle cx="50" cy="46" r="22" fill="#FFEDD5"/>
      <path d="M30 34C30 34 38 22 50 22C62 22 70 34 70 34" fill="#7C2D12"/>
      <circle cx="43" cy="45" r="2.5" fill="#7C2D12"/>
      <circle cx="57" cy="45" r="2.5" fill="#7C2D12"/>
      <path d="M44 54C46 56 54 56 56 54" stroke="#7C2D12" stroke-width="2" stroke-linecap="round"/>
      <path d="M24 90C24 74 35 70 50 70C65 70 76 74 76 90" fill="#EA580C"/>
      <path d="M40 76L50 82L60 76" stroke="#FEF3C7" stroke-width="2.5" stroke-linecap="round"/>
    </svg>`,
  },
  {
    id: 'preset:falcon_palestine',
    name: 'صقر فلسطين',
    category: 'mascot',
    svg: `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="50" cy="50" r="50" fill="#18181B"/>
      <circle cx="50" cy="48" r="26" fill="#F4F4F5"/>
      <path d="M50 22L62 38H38L50 22Z" fill="#15803D"/>
      <circle cx="42" cy="44" r="3.5" fill="#B91C1C"/>
      <circle cx="58" cy="44" r="3.5" fill="#B91C1C"/>
      <path d="M46 50L50 62L54 50H46Z" fill="#EAB308"/>
      <path d="M22 92C22 76 34 72 50 72C66 72 78 76 78 92" fill="#27272A"/>
    </svg>`,
  },
  {
    id: 'preset:trophy_gold',
    name: 'بطل المركز الأول',
    category: 'mascot',
    svg: `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="50" cy="50" r="50" fill="#854D0E"/>
      <circle cx="50" cy="50" r="36" fill="#FEF08A"/>
      <path d="M35 34H65V46C65 54 58 60 50 60C42 60 35 54 35 46V34Z" fill="#FACC15" stroke="#CA8A04" stroke-width="2"/>
      <path d="M35 38H28C26 38 24 40 24 42C24 48 30 52 35 52" stroke="#CA8A04" stroke-width="2"/>
      <path d="M65 38H72C74 38 76 40 76 42C76 48 70 52 65 52" stroke="#CA8A04" stroke-width="2"/>
      <rect x="46" y="60" width="8" height="12" fill="#CA8A04"/>
      <rect x="40" y="72" width="20" height="6" rx="2" fill="#A16207"/>
      <path d="M50 39L52 43H56L53 45L54 49L50 46L46 49L47 45L44 43H48L50 39Z" fill="#A16207"/>
    </svg>`,
  },
  {
    id: 'preset:math_genius',
    name: 'عبقري الرياضيات',
    category: 'academic',
    svg: `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="50" cy="50" r="50" fill="#0284C7"/>
      <circle cx="50" cy="46" r="22" fill="#E0F2FE"/>
      <path d="M32 30C38 24 62 24 68 30" stroke="#0369A1" stroke-width="4" stroke-linecap="round"/>
      <circle cx="43" cy="44" r="2.5" fill="#0369A1"/>
      <circle cx="57" cy="44" r="2.5" fill="#0369A1"/>
      <path d="M44 54C47 56 53 56 56 54" stroke="#0369A1" stroke-width="2" stroke-linecap="round"/>
      <path d="M24 90C24 74 35 70 50 70C65 70 76 74 76 90" fill="#0369A1"/>
      <text x="46" y="84" font-family="monospace" font-size="12" font-weight="bold" fill="#BAE6FD">π</text>
    </svg>`,
  },
  {
    id: 'preset:physics_atom',
    name: 'مبتكر الفيزياء',
    category: 'academic',
    svg: `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="50" cy="50" r="50" fill="#4338CA"/>
      <circle cx="50" cy="50" r="10" fill="#818CF8"/>
      <ellipse cx="50" cy="50" rx="34" ry="12" stroke="#A5B4FC" stroke-width="2" transform="rotate(30 50 50)"/>
      <ellipse cx="50" cy="50" rx="34" ry="12" stroke="#A5B4FC" stroke-width="2" transform="rotate(-30 50 50)"/>
      <ellipse cx="50" cy="50" rx="34" ry="12" stroke="#A5B4FC" stroke-width="2" transform="rotate(90 50 50)"/>
      <circle cx="70" cy="40" r="3" fill="#C7D2FE"/>
      <circle cx="30" cy="60" r="3" fill="#C7D2FE"/>
    </svg>`,
  },
  {
    id: 'preset:quran_star',
    name: 'التربية الإسلامية',
    category: 'academic',
    svg: `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="50" cy="50" r="50" fill="#047857"/>
      <circle cx="50" cy="50" r="36" fill="#065F46"/>
      <rect x="36" y="36" width="28" height="28" fill="#10B981" rx="4" transform="rotate(45 50 50)"/>
      <circle cx="50" cy="50" r="14" fill="#047857"/>
      <circle cx="50" cy="50" r="10" fill="#FBBF24"/>
      <circle cx="52" cy="49" r="9" fill="#047857"/>
    </svg>`,
  },
  {
    id: 'preset:star_student',
    name: 'النجم الصاعد',
    category: 'creative',
    svg: `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="50" cy="50" r="50" fill="#E11D48"/>
      <path d="M50 18L58 36L78 38L62 52L67 72L50 61L33 72L38 52L22 38L42 36L50 18Z" fill="#FDE047" stroke="#F59E0B" stroke-width="2"/>
      <circle cx="44" cy="44" r="2.5" fill="#881337"/>
      <circle cx="56" cy="44" r="2.5" fill="#881337"/>
      <path d="M45 51C47 54 53 54 55 51" stroke="#881337" stroke-width="2" stroke-linecap="round"/>
    </svg>`,
  },
  {
    id: 'preset:owl_wise',
    name: 'بومة المعرفة',
    category: 'mascot',
    svg: `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="50" cy="50" r="50" fill="#451A03"/>
      <ellipse cx="50" cy="54" rx="28" ry="32" fill="#78350F"/>
      <circle cx="38" cy="46" r="11" fill="#FEF3C7"/>
      <circle cx="62" cy="46" r="11" fill="#FEF3C7"/>
      <circle cx="39" cy="46" r="5" fill="#1C1917"/>
      <circle cx="61" cy="46" r="5" fill="#1C1917"/>
      <path d="M47 54L50 60L53 54H47Z" fill="#F59E0B"/>
      <path d="M50 18L66 28L50 36L34 28L50 18Z" fill="#1C1917"/>
      <path d="M66 28V36" stroke="#F59E0B" stroke-width="2" stroke-linecap="round"/>
    </svg>`,
  },
  {
    id: 'preset:rocket_success',
    name: 'صاروخ التفوق',
    category: 'creative',
    svg: `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="50" cy="50" r="50" fill="#1E1B4B"/>
      <path d="M50 20C50 20 62 36 62 58H38C38 36 50 20 50 20Z" fill="#F43F5E"/>
      <circle cx="50" cy="42" r="6" fill="#E0E7FF" stroke="#312E81" stroke-width="2"/>
      <path d="M38 52L26 64V56L38 48V52Z" fill="#6366F1"/>
      <path d="M62 52L74 64V56L62 48V52Z" fill="#6366F1"/>
      <path d="M42 58L50 78L58 58H42Z" fill="#FBBF24"/>
      <path d="M45 58L50 70L55 58H45Z" fill="#EF4444"/>
    </svg>`,
  },
  {
    id: 'preset:cyber_student',
    name: 'طالب التكنولوجيا (حاسوب)',
    category: 'creative',
    svg: `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="50" cy="50" r="50" fill="#0F172A"/>
      <rect x="28" y="32" width="44" height="30" rx="4" fill="#1E293B" stroke="#06B6D4" stroke-width="2"/>
      <circle cx="42" cy="46" r="3" fill="#22D3EE"/>
      <circle cx="58" cy="46" r="3" fill="#22D3EE"/>
      <path d="M45 54H55" stroke="#22D3EE" stroke-width="2" stroke-linecap="round"/>
      <rect x="22" y="66" width="56" height="4" rx="2" fill="#334155"/>
      <path d="M26 88C26 76 36 72 50 72C64 72 74 76 74 88" fill="#0284C7"/>
    </svg>`,
  },
  {
    id: 'preset:palestine_map_badge',
    name: 'خارطة الوطن',
    category: 'mascot',
    svg: `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="50" cy="50" r="50" fill="#064E3B"/>
      <circle cx="50" cy="50" r="38" fill="#047857" stroke="#FDE047" stroke-width="2"/>
      <path d="M46 22C46 22 52 26 53 32C54 38 48 46 48 54C48 62 52 70 50 78C48 80 46 76 46 70C46 64 43 56 44 48C45 40 45 30 46 22Z" fill="#FEF08A"/>
      <circle cx="50" cy="48" r="3" fill="#DC2626"/>
    </svg>`,
  },
  {
    id: 'preset:bookworm_gold',
    name: 'قارئ متميز',
    category: 'academic',
    svg: `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="50" cy="50" r="50" fill="#78350F"/>
      <circle cx="50" cy="44" r="20" fill="#FDE68A"/>
      <circle cx="42" cy="42" r="6" stroke="#78350F" stroke-width="2" fill="none"/>
      <circle cx="58" cy="42" r="6" stroke="#78350F" stroke-width="2" fill="none"/>
      <path d="M48 42H52" stroke="#78350F" stroke-width="2"/>
      <circle cx="42" cy="42" r="2" fill="#78350F"/>
      <circle cx="58" cy="42" r="2" fill="#78350F"/>
      <path d="M45 52C47 54 53 54 55 52" stroke="#78350F" stroke-width="2" stroke-linecap="round"/>
      <path d="M26 88C26 74 36 68 50 68C64 68 74 74 74 88" fill="#D97706"/>
    </svg>`,
  },
  {
    id: 'preset:champion_crown',
    name: 'تاج التفوق والريادة',
    category: 'mascot',
    svg: `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="50" cy="50" r="50" fill="#4C1D95"/>
      <path d="M26 62L32 38L42 50L50 32L58 50L68 38L74 62H26Z" fill="#FACC15" stroke="#EAB308" stroke-width="2"/>
      <circle cx="32" cy="36" r="3" fill="#EF4444"/>
      <circle cx="50" cy="30" r="3.5" fill="#3B82F6"/>
      <circle cx="68" cy="36" r="3" fill="#10B981"/>
      <rect x="26" y="62" width="48" height="6" rx="2" fill="#EAB308"/>
      <circle cx="38" cy="65" r="1.5" fill="#7C3AED"/>
      <circle cx="50" cy="65" r="1.5" fill="#7C3AED"/>
      <circle cx="62" cy="65" r="1.5" fill="#7C3AED"/>
    </svg>`,
  },
];

/**
 * Returns preset SVG markup if ID starts with 'preset:'
 */
export function getPresetSvg(presetId?: string | null): string | null {
  if (!presetId || !presetId.startsWith('preset:')) return null;
  const item = PRESET_AVATARS.find((p) => p.id === presetId);
  return item ? item.svg : null;
}

/**
 * Validates selected file before compression
 */
export function validateAvatarFile(file: File): { valid: boolean; error?: string } {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: 'نوع الملف غير مدعوم. يرجى اختيار صورة بصيغة JPEG أو PNG أو WebP فقط (لا يُقبل GIF أو SVG).',
    };
  }

  // Max 5MB
  const maxBytes = 5 * 1024 * 1024;
  if (file.size > maxBytes) {
    return {
      valid: false,
      error: 'حجم الصورة كبير جداً، الحد الأقصى المسموح به هو 5 ميجابايت قبل الضغط.',
    };
  }

  return { valid: true };
}

/**
 * Strips EXIF metadata & compresses avatar to 256x256 (under 30KB) and 64x64 thumbnail (under 5KB)
 * Runs entirely on HTML5 Canvas in client memory
 */
export async function cropAndCompressAvatar(
  img: HTMLImageElement,
  cropBox: { x: number; y: number; size: number }
): Promise<{
  fullDataUrl: string;
  thumbDataUrl: string;
  fullSizeKb: number;
  thumbSizeKb: number;
}> {
  // 1. Create main canvas 256x256
  const fullCanvas = document.createElement('canvas');
  fullCanvas.width = 256;
  fullCanvas.height = 256;
  const fullCtx = fullCanvas.getContext('2d');
  if (!fullCtx) throw new Error('فشل تهيئة معالج الصور (Canvas).');

  // Fill with clean white background in case of transparent png
  fullCtx.fillStyle = '#FFFFFF';
  fullCtx.fillRect(0, 0, 256, 256);

  // Draw cropped region (strips all EXIF automatically)
  fullCtx.drawImage(
    img,
    cropBox.x,
    cropBox.y,
    cropBox.size,
    cropBox.size,
    0,
    0,
    256,
    256
  );

  // 2. Compress main avatar: target < 30KB (approx 40,000 base64 chars)
  let quality = 0.82;
  let fullDataUrl = fullCanvas.toDataURL('image/webp', quality);
  // Fallback to jpeg if webp not supported by browser
  if (!fullDataUrl.startsWith('data:image/webp')) {
    fullDataUrl = fullCanvas.toDataURL('image/jpeg', quality);
  }

  // Iteratively reduce quality until fullDataUrl length < 40,000 (~30KB)
  while (fullDataUrl.length > 39000 && quality > 0.25) {
    quality -= 0.1;
    fullDataUrl = fullCanvas.toDataURL('image/webp', quality);
    if (!fullDataUrl.startsWith('data:image/webp')) {
      fullDataUrl = fullCanvas.toDataURL('image/jpeg', quality);
    }
  }

  // 3. Create thumbnail canvas 64x64
  const thumbCanvas = document.createElement('canvas');
  thumbCanvas.width = 64;
  thumbCanvas.height = 64;
  const thumbCtx = thumbCanvas.getContext('2d');
  if (!thumbCtx) throw new Error('فشل تهيئة المصغرة.');

  thumbCtx.fillStyle = '#FFFFFF';
  thumbCtx.fillRect(0, 0, 64, 64);
  thumbCtx.drawImage(fullCanvas, 0, 0, 256, 256, 0, 0, 64, 64);

  // Target thumbnail strictly < 5KB (approx 6,800 chars)
  let thumbQuality = 0.75;
  let thumbDataUrl = thumbCanvas.toDataURL('image/webp', thumbQuality);
  if (!thumbDataUrl.startsWith('data:image/webp')) {
    thumbDataUrl = thumbCanvas.toDataURL('image/jpeg', thumbQuality);
  }

  while (thumbDataUrl.length > 6800 && thumbQuality > 0.2) {
    thumbQuality -= 0.1;
    thumbDataUrl = thumbCanvas.toDataURL('image/webp', thumbQuality);
    if (!thumbDataUrl.startsWith('data:image/webp')) {
      thumbDataUrl = thumbCanvas.toDataURL('image/jpeg', thumbQuality);
    }
  }

  const fullSizeKb = Math.round((fullDataUrl.length * (3 / 4)) / 1024);
  const thumbSizeKb = Math.round((thumbDataUrl.length * (3 / 4)) / 1024);

  return {
    fullDataUrl,
    thumbDataUrl,
    fullSizeKb,
    thumbSizeKb,
  };
}
