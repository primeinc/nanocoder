import type {ImageContent, MessageContent, TextContent} from '@/types/core';
import type {InputState} from '../types/hooks.js';
import {PlaceholderType} from '../types/hooks.js';

/**
 * Assemble message content from InputState, handling both text and images.
 * This creates a multimodal content array when images are present.
 *
 * @param inputState - The input state with display text and placeholders
 * @returns MessageContent - Either a simple string or an array with text and images
 */
export function assembleMessageContent(inputState: InputState): MessageContent {
	const {displayValue, placeholderContent} = inputState;

	// Check if we have any image placeholders
	const hasImages = Object.values(placeholderContent).some(
		p => p.type === PlaceholderType.IMAGE,
	);

	// If no images, use the simple text assembly
	if (!hasImages) {
		return assembleTextContent(inputState);
	}

	// Build multimodal content array
	const contentParts: Array<TextContent | ImageContent> = [];

	// Track position in the display value as we process placeholders
	let currentText = displayValue;

	// Sort placeholders by their position in the display value
	const sortedPlaceholders = Object.entries(placeholderContent).sort((a, b) => {
		const posA = displayValue.indexOf(a[1].displayText);
		const posB = displayValue.indexOf(b[1].displayText);
		return posA - posB;
	});

	for (const [_id, placeholder] of sortedPlaceholders) {
		const placeholderText = placeholder.displayText;
		const placeholderIndex = currentText.indexOf(placeholderText);

		if (placeholderIndex === -1) {
			continue;
		}

		// Add any text before this placeholder
		const textBefore = currentText.substring(0, placeholderIndex);
		if (textBefore.trim()) {
			contentParts.push({
				type: 'text',
				text: textBefore,
			});
		}

		// Handle the placeholder based on its type
		if (placeholder.type === PlaceholderType.IMAGE) {
			// Add image content
			contentParts.push({
				type: 'image_url',
				image_url: {
					url: placeholder.dataURL,
				},
			});
		} else if (placeholder.type === PlaceholderType.FILE) {
			// Add file content as text with header
			const fileName =
				placeholder.filePath.split('/').pop() || placeholder.filePath;
			const header = `=== File: ${fileName} ===`;
			const footer = '='.repeat(header.length);
			const fileText = `${header}\n${placeholder.content}\n${footer}`;

			contentParts.push({
				type: 'text',
				text: fileText,
			});
		} else if (placeholder.type === PlaceholderType.PASTE) {
			// Add paste content as text
			contentParts.push({
				type: 'text',
				text: placeholder.content,
			});
		}

		// Move past this placeholder
		currentText = currentText.substring(
			placeholderIndex + placeholderText.length,
		);
	}

	// Add any remaining text
	if (currentText.trim()) {
		contentParts.push({
			type: 'text',
			text: currentText,
		});
	}

	// If we ended up with no content parts, return empty string
	if (contentParts.length === 0) {
		return '';
	}

	// If we only have one text part and no images, return as string
	if (contentParts.length === 1 && contentParts[0].type === 'text') {
		return contentParts[0].text;
	}

	return contentParts;
}

/**
 * Assemble text-only content from InputState (legacy path)
 * Used when there are no images
 */
function assembleTextContent(inputState: InputState): string {
	let assembledText = inputState.displayValue;

	// Replace each placeholder with its full content
	Object.entries(inputState.placeholderContent).forEach(
		([_id, placeholderContent]) => {
			let replacementContent = '';

			// Type-specific content assembly
			switch (placeholderContent.type) {
				case PlaceholderType.PASTE: {
					replacementContent = placeholderContent.content;
					break;
				}
				case PlaceholderType.FILE: {
					// Format file content with header for LLM context
					const fileName =
						placeholderContent.filePath.split('/').pop() ||
						placeholderContent.filePath;
					const header = `=== File: ${fileName} ===`;
					const footer = '='.repeat(header.length);
					replacementContent = `${header}\n${placeholderContent.content}\n${footer}`;
					break;
				}
				case PlaceholderType.IMAGE: {
					// Images should be handled in multimodal path, not here
					// But if we somehow end up here, just use a placeholder text
					replacementContent = `[Image: ${placeholderContent.filePath}]`;
					break;
				}
				default: {
					// Exhaustiveness check
					placeholderContent satisfies never;
					break;
				}
			}

			// Replace the placeholder with its content
			const displayText = placeholderContent.displayText;
			if (displayText) {
				assembledText = assembledText.replace(displayText, replacementContent);
			}
		},
	);

	return assembledText;
}
