import type {Message, MessageContent, ToolResult} from '@/types/core';

/**
 * Builder pattern for constructing message arrays.
 * Provides a fluent interface for adding messages without side effects.
 * This ensures messages are only added to state once, preventing duplication.
 */
export class MessageBuilder {
	private messages: Message[];

	constructor(initialMessages: Message[]) {
		this.messages = [...initialMessages];
	}

	/**
	 * Add auto-executed messages from AI SDK multi-step execution.
	 * These include both assistant messages (with tool_calls) and tool result messages.
	 */
	addAutoExecutedMessages(autoMessages: Message[]): this {
		this.messages.push(...autoMessages);
		return this;
	}

	/**
	 * Add an assistant message (with or without tool_calls).
	 */
	addAssistantMessage(msg: Message): this {
		if (msg.role !== 'assistant') {
			throw new Error(
				'addAssistantMessage requires a message with role "assistant"',
			);
		}
		this.messages.push(msg);
		return this;
	}

	/**
	 * Add tool result messages from tool execution.
	 */
	addToolResults(results: ToolResult[]): this {
		const toolMessages: Message[] = results.map(result => ({
			role: 'tool' as const,
			content: result.content || '',
			tool_call_id: result.tool_call_id,
			name: result.name,
		}));
		this.messages.push(...toolMessages);
		return this;
	}

	/**
	 * Add a user message with support for multimodal content.
	 */
	addUserMessage(content: MessageContent): this {
		this.messages.push({
			role: 'user',
			content,
		});
		return this;
	}

	/**
	 * Add an error message as a user message (for model self-correction).
	 */
	addErrorMessage(errorContent: string): this {
		this.messages.push({
			role: 'user',
			content: errorContent,
		});
		return this;
	}

	/**
	 * Add an arbitrary message (use sparingly, prefer specific methods).
	 */
	addMessage(message: Message): this {
		this.messages.push(message);
		return this;
	}

	/**
	 * Build and return the final messages array.
	 */
	build(): Message[] {
		return this.messages;
	}

	/**
	 * Get the current length of the messages array.
	 */
	get length(): number {
		return this.messages.length;
	}

	/**
	 * Check if the builder has any messages.
	 */
	get isEmpty(): boolean {
		return this.messages.length === 0;
	}
}
