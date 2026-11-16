import React, { useId, useState } from 'react';

export interface OakFramePreset {
  outerPath: string;
  innerPath: string;
  wavePath: string;
}

// Three organic sculpted oak-frame silhouettes shared across Categories and Product Cards (400x360 viewBox)
export const OAK_FRAME_PRESETS: OakFramePreset[] = [
  {
    outerPath:
      'M 8 206 C 10 82 92 26 226 14 C 338 4 392 46 392 162 C 392 248 389 294 366 324 C 340 352 238 354 126 350 C 42 347 8 316 8 248 Z',
    innerPath:
      'M 19 204 C 21 90 98 37 226 26 C 330 17 380 54 380 162 C 380 242 377 286 356 314 C 332 340 236 342 128 338 C 52 335 19 308 19 246 Z',
    wavePath:
      'M 0 228 C 88 204 176 252 268 236 C 328 226 364 210 400 218 L 400 370 L 0 370 Z',
  },
  {
    outerPath:
      'M 8 216 C 12 94 108 20 240 10 C 344 3 392 54 392 170 C 392 256 385 298 360 326 C 332 354 224 354 118 348 C 40 344 8 310 8 246 Z',
    innerPath:
      'M 19 214 C 23 102 114 32 240 22 C 336 16 380 62 380 170 C 380 250 374 290 350 316 C 324 342 222 342 120 336 C 50 332 19 302 19 244 Z',
    wavePath:
      'M 0 224 C 82 244 178 210 264 232 C 326 246 368 222 400 226 L 400 370 L 0 370 Z',
  },
  {
    outerPath:
      'M 8 224 C 14 100 106 28 248 16 C 348 8 392 48 392 164 C 392 250 388 294 364 324 C 338 352 230 354 122 350 C 40 347 8 314 8 250 Z',
    innerPath:
      'M 19 222 C 25 108 112 40 248 28 C 340 20 380 56 380 164 C 380 244 376 286 354 314 C 330 340 228 342 124 338 C 50 335 19 306 19 248 Z',
    wavePath:
      'M 0 220 C 90 246 186 222 280 234 C 336 241 370 214 400 218 L 400 370 L 0 370 Z',
  },
];

export const OakFramedProductImage: React.FC<{
  src?: string | null;
  alt: string;
  presetIndex: number;
  isActive?: boolean;
}> = ({ src, alt, presetIndex, isActive = false }) => {
  const rawUid = useId();
  const uid = rawUid.replace(/:/g, '');
  const [imgFailed, setImgFailed] = useState(false);

  const preset = OAK_FRAME_PRESETS[Math.abs(presetIndex) % OAK_FRAME_PRESETS.length];
  const clipId = `prod-clip-${uid}`;
  const gradId = `prod-wood-${uid}`;
  const tintId = `prod-tint-${uid}`;
  const fallbackGradId = `prod-fallback-${uid}`;

  return (
    <svg
      viewBox="0 0 400 360"
      className={`w-full h-full transition-[filter] duration-200 ${
        isActive
          ? 'drop-shadow-[0_16px_24px_rgba(68,42,20,0.20)]'
          : 'drop-shadow-[0_12px_20px_rgba(68,42,20,0.15)] group-hover:drop-shadow-[0_18px_28px_rgba(68,42,20,0.22)]'
      }`}
      role="img"
      aria-label={alt}
    >
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#CEA173" />
          <stop offset="45%" stopColor="#B07D4F" />
          <stop offset="100%" stopColor="#865833" />
        </linearGradient>
        <linearGradient id={tintId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#7C532E" stopOpacity="0.04" />
          <stop offset="72%" stopColor="#7C532E" stopOpacity="0" />
          <stop offset="100%" stopColor="#4E3119" stopOpacity="0.10" />
        </linearGradient>
        <linearGradient id={fallbackGradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#EFE6DA" />
          <stop offset="100%" stopColor="#DECBB4" />
        </linearGradient>
        <clipPath id={clipId}>
          <path d={preset.innerPath} />
        </clipPath>
      </defs>

      {/* Outer Solid Oak Wood Frame */}
      <path d={preset.outerPath} fill={`url(#${gradId})`} />
      <path
        d={preset.outerPath}
        fill="none"
        stroke="rgba(255,244,228,0.52)"
        strokeWidth="1.5"
      />

      {/* Clipped Full-Frame Product Photo */}
      <g clipPath={`url(#${clipId})`}>
        <rect x="0" y="0" width="400" height="360" fill={`url(#${fallbackGradId})`} />
        {!imgFailed && src && (
          <image
            href={src}
            x="10"
            y="8"
            width="380"
            height="344"
            preserveAspectRatio="xMidYMid slice"
            onError={() => setImgFailed(true)}
            className="origin-center transition-transform duration-500 ease-out group-hover:scale-[1.04]"
          />
        )}
        <rect x="0" y="0" width="400" height="360" fill={`url(#${tintId})`} />
      </g>

      {/* Recessed Wood Rim Inner Bevel */}
      <path
        d={preset.innerPath}
        fill="none"
        stroke="rgba(72, 44, 21, 0.28)"
        strokeWidth="2.5"
      />
    </svg>
  );
};
