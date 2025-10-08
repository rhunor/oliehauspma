// src/constants/cdn.ts - GitHub CDN Configuration
// FIXED: Proper TypeScript typing for CDN constants

export const GITHUB_CDN_BASE = "https://cdn.jsdelivr.net/gh/rhunor/olivehausimages@main" as const;

// Type-safe CDN image paths
export const CDN_IMAGES = {
  hero: {
    login: `${GITHUB_CDN_BASE}/images/hero/1.webp`,
  },
} as const;

// Type for CDN image paths
export type CDNImagePath = typeof CDN_IMAGES;