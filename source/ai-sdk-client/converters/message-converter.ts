import type {
	AssistantContent,
	ImagePart,
	ModelMessage,
	TextPart,
	ToolCallPart,
	UserContent,
} from 'ai';
import type {Message} from '@/types/index';
import type {TestableMessage} from '../types.js';

/**
 * Checks if an assistant message is empty (no content and no tool calls).
 * Empty assistant messages cause API errors:
 * "400 Bad Request: Assistant message must have either content or tool_calls, but not none."
 *
 * Exported for testing purposes.
 */
export function isEmptyAssistantMessage(message: TestableMessage): boolean {
	if (message.role !== 'assistant') {
		return false;
	}
	// Check for content - handle both string and array content formats
	const hasContent = Array.isArray(message.content)
		? message.content.length > 0
		: typeof message.content === 'string' && message.content.trim().length > 0;
	// Tool calls are in a separate property for AI SDK messages
	const hasToolCalls =
		'toolCalls' in message &&
		Array.isArray(message.toolCalls) &&
		message.toolCalls.length > 0;
	return !hasContent && !hasToolCalls;
}

/**
 * Convert our Message format to AI SDK v6 ModelMessage format
 *
 * Tool messages: Converted to AI SDK tool-result format with proper structure.
 * User messages: Support both string and multimodal content arrays
 */
export function convertToModelMessages(messages: Message[]): ModelMessage[] {
	return messages.map((msg): ModelMessage => {
		if (msg.role === 'tool') {
			// Tool messages must have string content
			const toolContent =
				typeof msg.content === 'string' ? msg.content : String(msg.content);

			// Convert to AI SDK tool-result format
			// AI SDK expects: { role: 'tool', content: [{ type: 'tool-result', toolCallId, toolName, output }] }
			// where output is { type: 'text', value: string } or { type: 'json', value: JSONValue }
			return {
				role: 'tool',
				content: [
					{
						type: 'tool-result',
						toolCallId: msg.tool_call_id || '',
						toolName: msg.name || '',
						output: {
							type: 'text',
							value: toolContent,
						},
					},
				],
			};
		}

		if (msg.role === 'system') {
			// System messages are always strings
			const systemContent =
				typeof msg.content === 'string' ? msg.content : String(msg.content);
			return {
				role: 'system',
				content: systemContent,
			};
		}

		if (msg.role === 'user') {
			// User messages can be string or multimodal array
			if (typeof msg.content === 'string') {
				return {
					role: 'user',
					content: msg.content,
				};
			}

			// Convert our multimodal format to AI SDK format
			const userContent: UserContent = msg.content.map(part => {
				if (part.type === 'text') {
					return {
						type: 'text',
						text: part.text,
					} as TextPart;
				}
				// Image content
				return {
					type: 'image',
					image: part.image_url.url,
				} as ImagePart;
			});

			return {
				role: 'user',
				content: userContent,
			};
		}

		if (msg.role === 'assistant') {
			// Build content array
			const content: AssistantContent = [];

			// Add text content if present
			if (msg.content) {
				// Assistant content is always string
				const textContent =
					typeof msg.content === 'string' ? msg.content : String(msg.content);
				content.push({
					type: 'text',
					text: textContent,
				} as TextPart);
			}

			// Add tool calls if present (for auto-executed messages)
			if (msg.tool_calls && msg.tool_calls.length > 0) {
				for (const toolCall of msg.tool_calls) {
					content.push({
						type: 'tool-call',
						toolCallId: toolCall.id,
						toolName: toolCall.function.name,
						input: toolCall.function.arguments,
					} as ToolCallPart);
				}
			}

			// If no content at all, add empty text to avoid empty message
			if (content.length === 0) {
				content.push({
					type: 'text',
					text: '',
				} as TextPart);
			}

			return {
				role: 'assistant',
				content,
			};
		}

		// Fallback - should never happen
		return {
			role: 'user',
			content:
				typeof msg.content === 'string' ? msg.content : String(msg.content),
		};
	});
}
