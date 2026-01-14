import test from 'ava';
import {PlaceholderType} from '@/types/hooks';
import type {InputState} from '@/types/hooks';
import {assembleMessageContent} from './message-content-assembler';

console.log('\nmessage-content-assembler.spec.ts');

// Test assembleMessageContent with text only
test('assembleMessageContent returns string for text-only input', t => {
	const inputState: InputState = {
		displayValue: 'Hello world',
		placeholderContent: {},
	};

	const result = assembleMessageContent(inputState);
	t.is(typeof result, 'string');
	t.is(result, 'Hello world');
});

// Test assembleMessageContent with paste placeholder
test('assembleMessageContent replaces paste placeholders', t => {
	const inputState: InputState = {
		displayValue: 'Check this: [Paste #1]',
		placeholderContent: {
			paste_1: {
				type: PlaceholderType.PASTE,
				displayText: '[Paste #1]',
				content: 'pasted content here',
				originalSize: 19,
			},
		},
	};

	const result = assembleMessageContent(inputState);
	t.is(typeof result, 'string');
	t.is(result, 'Check this: pasted content here');
});

// Test assembleMessageContent with file placeholder
test('assembleMessageContent replaces file placeholders with header', t => {
	const inputState: InputState = {
		displayValue: 'Review [@app.tsx]',
		placeholderContent: {
			file_1: {
				type: PlaceholderType.FILE,
				displayText: '[@app.tsx]',
				filePath: '/path/to/app.tsx',
				content: 'const app = {};\nexport default app;',
				fileSize: 100,
			},
		},
	};

	const result = assembleMessageContent(inputState);
	t.is(typeof result, 'string');
	t.true(result.includes('=== File: app.tsx ==='));
	t.true(result.includes('const app = {};'));
	t.true(result.includes('Review '));
});

// Test assembleMessageContent with image (returns array)
test('assembleMessageContent returns array for images', t => {
	const inputState: InputState = {
		displayValue: 'Look at [@image.png]',
		placeholderContent: {
			image_1: {
				type: PlaceholderType.IMAGE,
				displayText: '[@image.png]',
				filePath: '/path/to/image.png',
				dataURL: 'data:image/png;base64,abc123',
				mimeType: 'image/png',
				fileSize: 1024,
			},
		},
	};

	const result = assembleMessageContent(inputState);
	t.true(Array.isArray(result));
	t.is(result.length, 2); // text + image

	// Check text part
	t.is(result[0].type, 'text');
	t.is(result[0].text, 'Look at ');

	// Check image part
	t.is(result[1].type, 'image_url');
	t.is(result[1].image_url.url, 'data:image/png;base64,abc123');
});

// Test assembleMessageContent with mixed content
test('assembleMessageContent handles text + file + image', t => {
	const inputState: InputState = {
		displayValue: 'Compare [@app.tsx] with [@screenshot.png]',
		placeholderContent: {
			file_1: {
				type: PlaceholderType.FILE,
				displayText: '[@app.tsx]',
				filePath: '/path/to/app.tsx',
				content: 'export const app = {};',
				fileSize: 100,
			},
			image_1: {
				type: PlaceholderType.IMAGE,
				displayText: '[@screenshot.png]',
				filePath: '/path/to/screenshot.png',
				dataURL: 'data:image/png;base64,xyz789',
				mimeType: 'image/png',
				fileSize: 2048,
			},
		},
	};

	const result = assembleMessageContent(inputState);
	t.true(Array.isArray(result));
	t.true(result.length >= 3); // text + file content + image

	// Should have image part
	const imagePart = result.find(part => part.type === 'image_url');
	t.truthy(imagePart);
	if (imagePart && imagePart.type === 'image_url') {
		t.is(imagePart.image_url.url, 'data:image/png;base64,xyz789');
	}

	// Should have file content in text
	const textParts = result.filter(part => part.type === 'text');
	const allText = textParts.map(p => p.text).join('');
	t.true(allText.includes('=== File: app.tsx ==='));
	t.true(allText.includes('export const app = {};'));
});

// Test assembleMessageContent with only image (no surrounding text)
test('assembleMessageContent handles single image', t => {
	const inputState: InputState = {
		displayValue: '[@photo.jpg]',
		placeholderContent: {
			image_1: {
				type: PlaceholderType.IMAGE,
				displayText: '[@photo.jpg]',
				filePath: '/path/to/photo.jpg',
				dataURL: 'data:image/jpeg;base64,abc123',
				mimeType: 'image/jpeg',
				fileSize: 5000,
			},
		},
	};

	const result = assembleMessageContent(inputState);
	t.true(Array.isArray(result));
	t.is(result.length, 1); // just image

	t.is(result[0].type, 'image_url');
	t.is(result[0].image_url.url, 'data:image/jpeg;base64,abc123');
});

// Test assembleMessageContent with empty input
test('assembleMessageContent handles empty input', t => {
	const inputState: InputState = {
		displayValue: '',
		placeholderContent: {},
	};

	const result = assembleMessageContent(inputState);
	t.is(result, '');
});

// Test assembleMessageContent with multiple images
test('assembleMessageContent handles multiple images', t => {
	const inputState: InputState = {
		displayValue: 'Compare [@img1.png] and [@img2.png]',
		placeholderContent: {
			image_1: {
				type: PlaceholderType.IMAGE,
				displayText: '[@img1.png]',
				filePath: '/path/to/img1.png',
				dataURL: 'data:image/png;base64,img1',
				mimeType: 'image/png',
				fileSize: 1000,
			},
			image_2: {
				type: PlaceholderType.IMAGE,
				displayText: '[@img2.png]',
				filePath: '/path/to/img2.png',
				dataURL: 'data:image/png;base64,img2',
				mimeType: 'image/png',
				fileSize: 1000,
			},
		},
	};

	const result = assembleMessageContent(inputState);
	t.true(Array.isArray(result));
	
	const imageParts = result.filter(part => part.type === 'image_url');
	t.is(imageParts.length, 2);
});
