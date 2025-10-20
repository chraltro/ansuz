/**
 * Get the correct asset path for both dev and production
 * In dev: base is "/"
 * In production: base is "/ansuz/"
 */
export function getAssetPath(path: string): string {
  // Remove leading slash if present
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;

  // In production (when deployed to GitHub Pages), use /ansuz/ prefix
  // In dev, use root /
  const base = import.meta.env.PROD ? '/ansuz/' : '/';

  return `${base}${cleanPath}`;
}
