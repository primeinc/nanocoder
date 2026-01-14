import {mkdir, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'ava';
import {
	encodeImageToDataURL,
	getImageMimeType,
	IMAGE_EXTENSIONS,
	isImageFile,
} from './image-utils.js';

console.log('\nimage-utils.spec.ts');

let testDir: string;

test.before(async () => {
	// Create a unique temp directory for our tests
	testDir = join(tmpdir(), `nanocoder-image-test-${Date.now()}`);
	await mkdir(testDir, {recursive: true});

	// Create a tiny valid PNG file (1x1 transparent pixel)
	const pngData = Buffer.from(
		'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
		'base64',
	);
	await writeFile(join(testDir, 'test.png'), pngData);

	// Create a tiny valid JPEG file
	const jpegData = Buffer.from(
		'/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAA//2Q==',
		'base64',
	);
	await writeFile(join(testDir, 'test.jpg'), jpegData);
	await writeFile(join(testDir, 'test.jpeg'), jpegData);

	// Create test files for other formats
	await writeFile(join(testDir, 'test.webp'), Buffer.from('RIFF....WEBP'));
	await writeFile(join(testDir, 'test.gif'), Buffer.from('GIF89a'));
});

test.after.always(async () => {
	// Clean up temp directory
	try {
		await rm(testDir, {recursive: true, force: true});
	} catch {
		// Ignore cleanup errors
	}
});

// Test isImageFile()
test('isImageFile returns true for PNG files', t => {
	t.true(isImageFile('photo.png'));
	t.true(isImageFile('/path/to/image.PNG')); // Case insensitive
	t.true(isImageFile('src/assets/icon.png'));
});

test('isImageFile returns true for JPEG files', t => {
	t.true(isImageFile('photo.jpg'));
	t.true(isImageFile('photo.jpeg'));
	t.true(isImageFile('/path/to/image.JPG'));
});

test('isImageFile returns true for other supported formats', t => {
	t.true(isImageFile('animation.gif'));
	t.true(isImageFile('modern.webp'));
});

test('isImageFile returns false for non-image files', t => {
	t.false(isImageFile('document.txt'));
	t.false(isImageFile('script.ts'));
	t.false(isImageFile('styles.css'));
	t.false(isImageFile('data.json'));
	t.false(isImageFile('video.mp4'));
});

test('isImageFile returns false for files without extensions', t => {
	t.false(isImageFile('README'));
	t.false(isImageFile('Makefile'));
});

// Test getImageMimeType()
test('getImageMimeType returns correct MIME type for PNG', t => {
	t.is(getImageMimeType('test.png'), 'image/png');
	t.is(getImageMimeType('test.PNG'), 'image/png');
});

test('getImageMimeType returns correct MIME type for JPEG', t => {
	t.is(getImageMimeType('test.jpg'), 'image/jpeg');
	t.is(getImageMimeType('test.jpeg'), 'image/jpeg');
	t.is(getImageMimeType('test.JPG'), 'image/jpeg');
});

test('getImageMimeType returns correct MIME type for other formats', t => {
	t.is(getImageMimeType('test.webp'), 'image/webp');
	t.is(getImageMimeType('test.gif'), 'image/gif');
});

test('getImageMimeType returns null for unsupported types', t => {
	t.is(getImageMimeType('test.txt'), null);
	t.is(getImageMimeType('test.mp4'), null);
	t.is(getImageMimeType('test.svg'), null);
});

// Test encodeImageToDataURL()
test('encodeImageToDataURL creates valid data URL for PNG', t => {
	const pngPath = join(testDir, 'test.png');
	const dataURL = encodeImageToDataURL(pngPath);

	t.true(dataURL.startsWith('data:image/png;base64,'));
	t.true(dataURL.length > 30); // Should have base64 content
});

test('encodeImageToDataURL creates valid data URL for JPEG', t => {
	const jpegPath = join(testDir, 'test.jpg');
	const dataURL = encodeImageToDataURL(jpegPath);

	t.true(dataURL.startsWith('data:image/jpeg;base64,'));
	t.true(dataURL.length > 30);
});

test('encodeImageToDataURL handles .jpeg extension', t => {
	const jpegPath = join(testDir, 'test.jpeg');
	const dataURL = encodeImageToDataURL(jpegPath);

	t.true(dataURL.startsWith('data:image/jpeg;base64,'));
});

test('encodeImageToDataURL throws for unsupported file type', t => {
	const error = t.throws(() => {
		encodeImageToDataURL('/path/to/file.txt');
	});

	t.true(error?.message.includes('Unsupported image type'));
});

test('IMAGE_EXTENSIONS contains expected formats', t => {
	t.true(IMAGE_EXTENSIONS.includes('.png'));
	t.true(IMAGE_EXTENSIONS.includes('.jpg'));
	t.true(IMAGE_EXTENSIONS.includes('.jpeg'));
	t.true(IMAGE_EXTENSIONS.includes('.webp'));
	t.true(IMAGE_EXTENSIONS.includes('.gif'));
	t.is(IMAGE_EXTENSIONS.length, 5);
});
