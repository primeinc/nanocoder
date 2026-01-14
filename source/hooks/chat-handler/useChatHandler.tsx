import React from 'react';
import {ConversationStateManager} from '@/app/utils/conversation-state';
import UserMessage from '@/components/user-message';
import type {Message, MessageContent} from '@/types/core';
import {MessageBuilder} from '@/utils/message-builder';
import {processPromptTemplate} from '@/utils/prompt-processor';
import {processAssistantResponse} from './conversation/conversation-loop';
import {createResetStreamingState} from './state/streaming-state';
import type {ChatHandlerReturn, UseChatHandlerProps} from './types';
import {checkContextUsage} from './utils/context-checker';
import {displayError as displayErrorHelper} from './utils/message-helpers';

/**
 * Main chat handler hook that manages LLM conversations and tool execution.
 * Orchestrates streaming responses, tool calls, and conversation state.
 */
export function useChatHandler({
	client,
	toolManager,
	messages,
	setMessages,
	currentProvider,
	currentModel,
	setIsCancelling,
	addToChatQueue,
	getNextComponentKey,
	abortController,
	setAbortController,
	developmentMode = 'normal',
	nonInteractiveMode = false,
	onStartToolConfirmationFlow,
	onConversationComplete,
}: UseChatHandlerProps): ChatHandlerReturn {
	// Conversation state manager for enhanced context
	const conversationStateManager = React.useRef(new ConversationStateManager());

	// State for streaming message content
	const [streamingContent, setStreamingContent] = React.useState<string>('');
	const [isGenerating, setIsGenerating] = React.useState<boolean>(false);
	const [tokenCount, setTokenCount] = React.useState<number>(0);

	// Helper to reset all streaming state
	const resetStreamingState = React.useCallback(
		createResetStreamingState(
			setIsCancelling,
			setAbortController,
			setIsGenerating,
			setStreamingContent,
			setTokenCount,
		),
		[], // Setters are stable and don't need to be in dependencies
	);

	// Helper to display errors in chat queue
	const displayError = React.useCallback(
		(error: unknown, keyPrefix: string) => {
			displayErrorHelper(error, keyPrefix, addToChatQueue, getNextComponentKey);
		},
		[addToChatQueue, getNextComponentKey],
	);

	// Reset conversation state when messages are cleared
	React.useEffect(() => {
		if (messages.length === 0) {
			conversationStateManager.current.reset();
		}
	}, [messages.length]);

	// Wrapper for processAssistantResponse that includes error handling
	const processAssistantResponseWithErrorHandling = React.useCallback(
		async (systemMessage: Message, msgs: Message[]) => {
			if (!client) return;

			try {
				await processAssistantResponse({
					systemMessage,
					messages: msgs,
					client,
					toolManager,
					abortController,
					setAbortController,
					setIsGenerating,
					setStreamingContent,
					setTokenCount,
					setMessages,
					addToChatQueue,
					getNextComponentKey,
					currentModel,
					developmentMode,
					nonInteractiveMode,
					conversationStateManager,
					onStartToolConfirmationFlow,
					onConversationComplete,
				});
			} catch (error) {
				displayError(error, 'chat-error');
				// Signal completion on error to avoid hanging in non-interactive mode
				onConversationComplete?.();
			} finally {
				resetStreamingState();
			}
		},
		[
			client,
			toolManager,
			abortController,
			setAbortController,
			setMessages,
			addToChatQueue,
			getNextComponentKey,
			currentModel,
			developmentMode,
			nonInteractiveMode,
			onStartToolConfirmationFlow,
			onConversationComplete,
			displayError,
			resetStreamingState,
		],
	);

	// Handle chat message processing
	const handleChatMessage = async (messageContent: MessageContent) => {
		if (!client || !toolManager) return;

		// Convert MessageContent to string for display
		// For multimodal content, we show a simplified version
		const displayMessage = getDisplayMessage(messageContent);

		// Add user message to chat using display version
		addToChatQueue(
			<UserMessage
				key={`user-${getNextComponentKey()}`}
				message={displayMessage}
			/>,
		);

		// Add user message to conversation history
		const builder = new MessageBuilder(messages);
		builder.addUserMessage(messageContent);
		const updatedMessages = builder.build();
		setMessages(updatedMessages);

		// Initialize conversation state if this is a new conversation
		// For multimodal messages, extract text for state initialization
		const textForState =
			typeof messageContent === 'string'
				? messageContent
				: messageContent
						.filter(part => part.type === 'text')
						.map(part => part.text)
						.join(' ');
		if (messages.length === 0) {
			conversationStateManager.current.initializeState(textForState);
		}

		// Create abort controller for cancellation
		const controller = new AbortController();
		setAbortController(controller);

		try {
			// Load and process system prompt
			const systemPrompt = processPromptTemplate();

			// Create stream request
			const systemMessage: Message = {
				role: 'system',
				content: systemPrompt,
			};

			// Check context usage and warn if approaching limit
			await checkContextUsage(
				updatedMessages,
				systemMessage,
				currentProvider,
				currentModel,
				addToChatQueue,
				getNextComponentKey,
			);

			// Use the conversation loop
			await processAssistantResponseWithErrorHandling(
				systemMessage,
				updatedMessages,
			);
		} catch (error) {
			displayError(error, 'chat-error');
		} finally {
			resetStreamingState();
		}
	};

	return {
		handleChatMessage,
		processAssistantResponse: processAssistantResponseWithErrorHandling,
		isGenerating,
		streamingContent,
		tokenCount,
	};
}

/**
 * Helper to get display message from MessageContent
 * For multimodal content, shows text parts and image placeholders
 */
function getDisplayMessage(content: MessageContent): string {
	if (typeof content === 'string') {
		return content;
	}

	// For array content, convert to display string
	return content
		.map(part => {
			if (part.type === 'text') {
				return part.text;
			}
			// For images, show a placeholder
			return '[Image]';
		})
		.join('');
}
