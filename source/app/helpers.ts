import type {MessageContent} from '@/types/core';
import type {
	NonInteractiveCompletionResult,
	NonInteractiveModeState,
} from './types';

/**
 * Helper function to determine if welcome message should be rendered
 */
export function shouldRenderWelcome(nonInteractiveMode?: boolean): boolean {
	return !nonInteractiveMode;
}

/**
 * Helper function to determine if non-interactive mode processing is complete
 */
export function isNonInteractiveModeComplete(
	appState: NonInteractiveModeState,
	startTime: number,
	maxExecutionTimeMs: number,
): NonInteractiveCompletionResult {
	const isComplete =
		!appState.isToolExecuting && !appState.isToolConfirmationMode;
	const _hasMessages = appState.messages.length > 0;
	const hasTimedOut = Date.now() - startTime > maxExecutionTimeMs;

	// Check for error messages in the messages array
	const hasErrorMessages = appState.messages.some(
		(message: {role: string; content: MessageContent}) => {
			const content =
				typeof message.content === 'string'
					? message.content
					: message.content
							.filter(part => part.type === 'text')
							.map(part => part.text)
							.join('');
			return (
				message.role === 'error' ||
				(typeof content === 'string' && content.toLowerCase().includes('error'))
			);
		},
	);

	// Check for tool approval required messages
	const hasToolApprovalRequired = appState.messages.some(
		(message: {role: string; content: MessageContent}) => {
			const content =
				typeof message.content === 'string'
					? message.content
					: message.content
							.filter(part => part.type === 'text')
							.map(part => part.text)
							.join('');
			return (
				typeof content === 'string' &&
				content.includes('Tool approval required')
			);
		},
	);

	if (hasTimedOut) {
		return {shouldExit: true, reason: 'timeout'};
	}

	if (hasToolApprovalRequired) {
		return {shouldExit: true, reason: 'tool-approval'};
	}

	if (hasErrorMessages) {
		return {shouldExit: true, reason: 'error'};
	}

	// Exit when conversation is complete and either:
	// - We have messages in history (for chat/bash commands), OR
	// - Conversation is marked complete (for display-only commands like /mcp)
	if (isComplete && appState.isConversationComplete) {
		return {shouldExit: true, reason: 'complete'};
	}

	return {shouldExit: false, reason: null};
}
