import {readFileSync} from 'node:fs';
import {extname} from 'node:path';

/**
 * Supported image file extensions for vision models
 */
export const IMAGE_EXTENSIONS = [
	'.png',
	'.jpg',
	'.jpeg',
	'.webp',
	'.gif',
] as const;

/**
 * MIME type mapping for image extensions
 */
const MIME_TYPE_MAP: Record<string, string> = {
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.webp': 'image/webp',
	'.gif': 'image/gif',
};

/**
 * Check if a file path points to an image based on its extension
 */
export function isImageFile(filePath: string): boolean {
	const ext = extname(filePath).toLowerCase();
	return IMAGE_EXTENSIONS.includes(ext as (typeof IMAGE_EXTENSIONS)[number]);
}

/**
 * Get MIME type for an image file
 */
export function getImageMimeType(filePath: string): string | null {
	const ext = extname(filePath).toLowerCase();
	return MIME_TYPE_MAP[ext] || null;
}

/**
 * Encode an image file to base64 data URL
 * @param filePath - Absolute path to the image file
 * @returns Data URL string (e.g., "data:image/png;base64,...")
 */
export function encodeImageToDataURL(filePath: string): string {
	const mimeType = getImageMimeType(filePath);
	if (!mimeType) {
		throw new Error(`Unsupported image type: ${filePath}`);
	}

	// Read file as buffer
	const imageBuffer = readFileSync(filePath);

	// Convert to base64
	const base64 = imageBuffer.toString('base64');

	// Return data URL
	return `data:${mimeType};base64,${base64}`;
}
