import React from 'react';
import {
	createClearMessagesHandler,
	handleMessageSubmission,
} from '@/app/utils/app-util';
import {
	ErrorMessage,
	SuccessMessage,
	WarningMessage,
} from '@/components/message-box';
import Status from '@/components/status';
import {setCurrentMode as setCurrentModeContext} from '@/context/mode-context';
import {CustomCommandExecutor} from '@/custom-commands/executor';
import {CustomCommandLoader} from '@/custom-commands/loader';
import {CheckpointManager} from '@/services/checkpoint-manager';
import type {
	CheckpointListItem,
	DevelopmentMode,
	LLMClient,
	LSPConnectionStatus,
	MCPConnectionStatus,
	Message,
	MessageContent,
} from '@/types';
import type {CustomCommand} from '@/types/commands';
import type {ThemePreset} from '@/types/ui';
import type {UpdateInfo} from '@/types/utils';
import {getLogger} from '@/utils/logging';
import {addToMessageQueue} from '@/utils/message-queue';

interface UseAppHandlersProps {
	// State
	messages: Message[];
	currentProvider: string;
	currentModel: string;
	currentTheme: ThemePreset;
	abortController: AbortController | null;
	updateInfo: UpdateInfo | null;
	mcpServersStatus: MCPConnectionStatus[] | undefined;
	lspServersStatus: LSPConnectionStatus[];
	preferencesLoaded: boolean;
	customCommandsCount: number;
	getNextComponentKey: () => number;
	customCommandCache: Map<string, CustomCommand>;
	customCommandLoader: CustomCommandLoader | null;
	customCommandExecutor: CustomCommandExecutor | null;

	// State setters
	updateMessages: (newMessages: Message[]) => void;
	setIsCancelling: (value: boolean) => void;
	setDevelopmentMode: (
		updater: DevelopmentMode | ((prev: DevelopmentMode) => DevelopmentMode),
	) => void;
	setIsConversationComplete: (value: boolean) => void;
	setIsToolExecuting: (value: boolean) => void;
	setIsCheckpointLoadMode: (value: boolean) => void;
	setCheckpointLoadData: (
		value: {
			checkpoints: CheckpointListItem[];
			currentMessageCount: number;
		} | null,
	) => void;

	// Callbacks
	addToChatQueue: (component: React.ReactNode) => void;
	setLiveComponent: (component: React.ReactNode) => void;
	client: LLMClient | null;
	getMessageTokens: (message: Message) => number;

	// Mode handlers
	enterModelSelectionMode: () => void;
	enterProviderSelectionMode: () => void;
	enterThemeSelectionMode: () => void;
	enterTitleShapeSelectionMode: () => void;
	enterNanocoderShapeSelectionMode: () => void;
	enterModelDatabaseMode: () => void;
	enterConfigWizardMode: () => void;
	enterMcpWizardMode: () => void;

	// Chat handler
	handleChatMessage: (message: MessageContent) => Promise<void>;
}

export interface AppHandlers {
	clearMessages: () => Promise<void>;
	handleCancel: () => void;
	handleToggleDevelopmentMode: () => void;
	handleShowStatus: () => void;
	handleCheckpointSelect: (
		checkpointName: string,
		createBackup: boolean,
	) => Promise<void>;
	handleCheckpointCancel: () => void;
	enterCheckpointLoadMode: (
		checkpoints: CheckpointListItem[],
		currentMessageCount: number,
	) => void;
	handleMessageSubmit: (message: MessageContent) => Promise<void>;
}

/**
 * Consolidates all app handler setup into a single hook
 */
export function useAppHandlers(props: UseAppHandlersProps): AppHandlers {
	const logger = getLogger();

	// Clear messages handler
	const clearMessages = React.useMemo(
		() => createClearMessagesHandler(props.updateMessages, props.client),
		[props.updateMessages, props.client],
	);

	// Cancel handler
	const handleCancel = React.useCallback(() => {
		if (props.abortController) {
			logger.info('Cancelling current operation', {
				operation: 'user_cancellation',
				hasAbortController: !!props.abortController,
			});

			props.setIsCancelling(true);
			props.abortController.abort();
		} else {
			logger.debug('Cancel requested but no active operation to cancel');
		}
	}, [props.abortController, props.setIsCancelling, logger]);

	// Toggle development mode handler
	const handleToggleDevelopmentMode = React.useCallback(() => {
		props.setDevelopmentMode(currentMode => {
			const modes: Array<'normal' | 'auto-accept' | 'plan'> = [
				'normal',
				'auto-accept',
				'plan',
			];
			const currentIndex = modes.indexOf(currentMode);
			const nextIndex = (currentIndex + 1) % modes.length;
			const nextMode = modes[nextIndex];

			logger.info('Development mode toggled', {
				previousMode: currentMode,
				nextMode,
				modeIndex: nextIndex,
				totalModes: modes.length,
			});

			// Sync global mode context for tool needsApproval logic
			setCurrentModeContext(nextMode);

			return nextMode;
		});
	}, [props.setDevelopmentMode, logger]);

	// Show status handler
	const handleShowStatus = React.useCallback(() => {
		logger.debug('Status display requested', {
			currentProvider: props.currentProvider,
			currentModel: props.currentModel,
			currentTheme: props.currentTheme,
		});

		props.addToChatQueue(
			<Status
				key={`status-${props.getNextComponentKey()}`}
				provider={props.currentProvider}
				model={props.currentModel}
				theme={props.currentTheme}
				updateInfo={props.updateInfo}
				mcpServersStatus={props.mcpServersStatus}
				lspServersStatus={props.lspServersStatus}
				preferencesLoaded={props.preferencesLoaded}
				customCommandsCount={props.customCommandsCount}
			/>,
		);
	}, [props, logger]);

	// Checkpoint select handler
	const handleCheckpointSelect = React.useCallback(
		async (checkpointName: string, createBackup: boolean) => {
			try {
				const manager = new CheckpointManager();

				if (createBackup) {
					try {
						await manager.saveCheckpoint(
							`backup-${new Date().toISOString().replace(/[:.]/g, '-')}`,
							props.messages,
							props.currentProvider,
							props.currentModel,
						);
					} catch (error) {
						addToMessageQueue(
							<WarningMessage
								key={`backup-warning-${Date.now()}`}
								message={`Warning: Failed to create backup: ${
									error instanceof Error ? error.message : 'Unknown error'
								}`}
								hideBox={true}
							/>,
						);
					}
				}

				const checkpointData = await manager.loadCheckpoint(checkpointName, {
					validateIntegrity: true,
				});

				await manager.restoreFiles(checkpointData);

				addToMessageQueue(
					<SuccessMessage
						key={`restore-success-${Date.now()}`}
						message={`✓ Checkpoint '${checkpointName}' restored successfully`}
						hideBox={true}
					/>,
				);
			} catch (error) {
				addToMessageQueue(
					<ErrorMessage
						key={`restore-error-${Date.now()}`}
						message={`Failed to restore checkpoint: ${
							error instanceof Error ? error.message : 'Unknown error'
						}`}
						hideBox={true}
					/>,
				);
			} finally {
				props.setIsCheckpointLoadMode(false);
				props.setCheckpointLoadData(null);
			}
		},
		[props],
	);

	// Checkpoint cancel handler
	const handleCheckpointCancel = React.useCallback(() => {
		props.setIsCheckpointLoadMode(false);
		props.setCheckpointLoadData(null);
	}, [props.setIsCheckpointLoadMode, props.setCheckpointLoadData]);

	// Enter checkpoint load mode handler
	const enterCheckpointLoadMode = React.useCallback(
		(checkpoints: CheckpointListItem[], currentMessageCount: number) => {
			props.setCheckpointLoadData({checkpoints, currentMessageCount});
			props.setIsCheckpointLoadMode(true);
		},
		[props.setCheckpointLoadData, props.setIsCheckpointLoadMode],
	);

	// Message submit handler
	const handleMessageSubmit = React.useCallback(
		async (message: MessageContent) => {
			// Reset conversation completion flag when starting a new message
			props.setIsConversationComplete(false);

			// Convert MessageContent to string for command parsing
			const messageString =
				typeof message === 'string'
					? message
					: message
							.filter(part => part.type === 'text')
							.map(part => part.text)
							.join('');

			// Wrap handleChatMessage to pass original MessageContent for regular messages
			const wrappedHandleChatMessage = async (_msg: string) => {
				// If this is a regular message (not a command), use the original MessageContent
				// Otherwise, commands get parsed string
				await props.handleChatMessage(message);
			};

			await handleMessageSubmission(messageString, {
				customCommandCache: props.customCommandCache,
				customCommandLoader: props.customCommandLoader,
				customCommandExecutor: props.customCommandExecutor,
				onClearMessages: clearMessages,
				onEnterModelSelectionMode: props.enterModelSelectionMode,
				onEnterProviderSelectionMode: props.enterProviderSelectionMode,
				onEnterThemeSelectionMode: props.enterThemeSelectionMode,
				onEnterModelDatabaseMode: props.enterModelDatabaseMode,
				onEnterConfigWizardMode: props.enterConfigWizardMode,
				onEnterMcpWizardMode: props.enterMcpWizardMode,
				onEnterCheckpointLoadMode: enterCheckpointLoadMode,
				onEnterTitleShapeSelectionMode: props.enterTitleShapeSelectionMode,
				onEnterNanocoderShapeSelectionMode:
					props.enterNanocoderShapeSelectionMode,
				onShowStatus: handleShowStatus,
				onHandleChatMessage: wrappedHandleChatMessage,
				onAddToChatQueue: props.addToChatQueue,
				setLiveComponent: props.setLiveComponent,
				setIsToolExecuting: props.setIsToolExecuting,
				onCommandComplete: () => props.setIsConversationComplete(true),
				getNextComponentKey: props.getNextComponentKey,
				setMessages: props.updateMessages,
				messages: props.messages,
				provider: props.currentProvider,
				model: props.currentModel,
				theme: props.currentTheme,
				updateInfo: props.updateInfo,
				getMessageTokens: props.getMessageTokens,
			});
		},
		[props, clearMessages, enterCheckpointLoadMode, handleShowStatus],
	);

	return {
		clearMessages,
		handleCancel,
		handleToggleDevelopmentMode,
		handleShowStatus,
		handleCheckpointSelect,
		handleCheckpointCancel,
		enterCheckpointLoadMode,
		handleMessageSubmit,
	};
}
