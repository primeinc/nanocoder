# GitHub Copilot Instructions for Nanocoder

This file provides context and guidance for GitHub Copilot when working with issues, pull requests, and code in the Nanocoder repository.

## Project Overview

Nanocoder is a **local-first CLI coding agent** built with React and Ink.js that brings the power of agentic coding tools (like Claude Code and Gemini CLI) to local models or controlled APIs like OpenRouter. The project emphasizes privacy, control, and community-led development.

**Core Technologies:**
- TypeScript (99% of codebase)
- React 19 with Ink.js for CLI rendering
- Vercel AI SDK for LLM integration
- AVA for testing
- Biome for formatting and linting
- Model Context Protocol (MCP) for extensibility

## Repository Structure

```
source/
├── ai-sdk-client/      # LLM client factory and providers
├── app/                # Main App component
├── commands/           # Built-in slash commands
├── components/         # Ink.js UI components
├── config/             # Configuration and preferences
├── custom-commands/    # User-defined markdown commands
├── hooks/              # React hooks (useAppState, useChatHandler, useToolHandler)
├── init/               # Project initialization
├── lsp/                # Language Server Protocol integration
├── mcp/                # Model Context Protocol servers
├── models/             # Data models and types
├── security/           # Security utilities
├── services/           # Service layer
├── tool-calling/       # Tool call parsers (XML/JSON)
└── tools/              # Built-in tools (file ops, bash, search)
```

## Development Commands

```bash
# Build and run
pnpm run build          # Compile TypeScript to dist/
pnpm run start          # Run compiled application
pnpm run dev            # Watch mode compilation

# Testing (run before committing)
pnpm run test:all       # Full suite: format, lint, types, AVA tests, knip
pnpm run test:ava       # Run AVA tests only
pnpm run test:types     # TypeScript type checking
pnpm run test:lint:fix  # Auto-fix lint/format issues

# VS Code extension
pnpm run build:vscode   # Build extension to assets/nanocoder-vscode.vsix
```

## Architecture Patterns

### State Management
All state lives in `useAppState.tsx` (50+ state variables). Other hooks (`useChatHandler`, `useToolHandler`, `useModeHandlers`) receive state and setters from it. `App.tsx` orchestrates these hooks together.

### LLM Client Architecture
- `client-factory.ts` creates clients via `createLLMClient(provider?)`
- Uses Vercel AI SDK with `createOpenAICompatible` for any OpenAI-compatible API
- Supports streaming responses and tool calling
- Provider configuration in `agents.config.json`

### Tool System
- Built-in tools: file operations, bash execution, web search, fetch
- MCP servers: Dynamic tool loading via Model Context Protocol
- Tool approval: Optional confirmation before execution
- Tool calling: XML primary format, JSON fallback

### Custom Commands
- Markdown files in `.nanocoder/commands/`
- YAML frontmatter for metadata
- Template variables with `{{parameter}}` syntax
- Namespace support via directories

## Code Style Guidelines

### TypeScript Standards
- **Strict mode** enabled with `@/*` path alias mapping to `source/*`
- **No `any` types**: Use proper type definitions
- **ESNext features**: Modern JavaScript/TypeScript
- **Functional components**: React hooks pattern

### Formatting (Biome)
- Tabs for indentation
- Single quotes
- Semicolons required
- Trailing commas
- Pre-commit hooks auto-format staged files

### Key Lint Rules
- `useExhaustiveDependencies: error`
- `noUnusedVariables: error`
- `noUnusedImports: error`

### Logging (Pino)
Use structured logging with context objects:

```typescript
import { getLogger } from '@/utils/logging';

const logger = getLogger();
logger.info('Tool execution completed', { 
  tool: 'read-file', 
  filePath: 'src/app.tsx', 
  duration: 42 
});
```

Log levels: `fatal`, `error`, `warn`, `info`, `http`, `debug`, `trace`

## Testing Guidelines

### Test Framework
- **AVA** with TypeScript support
- Test files: `*.spec.ts` alongside source code
- Serial execution: Tests run one at a time
- Location: `source/**/*.spec.ts`

### Test Organization
- Simple tests: Place alongside source (`parser.ts` → `parser.spec.ts`)
- Complex tests: Use `__tests__/` directory with shared utilities
- Example: `source/hooks/__tests__/useInputState.*.spec.ts`

### Test Requirements
- New features **must** include passing tests
- Cover both success and error scenarios
- Test with multiple AI providers when applicable
- Mock external dependencies (APIs, file system)

### Running Tests
```bash
pnpm run test:all                          # Full test suite
pnpm run test:ava                          # AVA tests only
pnpm run test:ava source/path/file.spec.ts # Single test file
```

## Common Patterns

### Adding a New Tool
1. Create tool in `source/tools/`
2. Implement tool interface with schema validation
3. Add error handling and logging
4. Write tests in `*.spec.ts`
5. Update tool documentation

### Adding a Slash Command
1. Create command in `source/commands/`
2. Implement command handler
3. Add to command registry
4. Update `/help` command
5. Add tests

### Working with MCP Servers
1. Configuration in `.mcp.json`
2. Server lifecycle in `source/mcp/`
3. Tool discovery and execution
4. Error handling for server failures

## AI Provider Support

Nanocoder supports any OpenAI-compatible API:
- **Local**: Ollama, LM Studio, vLLM, LocalAI, llama.cpp
- **Cloud**: OpenRouter, OpenAI, Poe, GitHub Models, Z.ai
- **Configuration**: `agents.config.json` (project or global)
- **Environment variables**: Supported with `$VAR` or `${VAR:-default}` syntax

## Contributing Guidelines

### Pull Request Checklist
- [ ] Code follows TypeScript strict mode and Biome style
- [ ] New features include tests in `.spec.ts` files
- [ ] All tests pass (`pnpm test:all`)
- [ ] Documentation updated (README, CONTRIBUTING, etc.)
- [ ] Commit messages follow conventional commits (`feat:`, `fix:`, `docs:`, etc.)
- [ ] No breaking changes (or clearly documented)
- [ ] Appropriate structured logging added

### Issue Labels
- `bug` - Something isn't working
- `enhancement` - New feature or improvement
- `good first issue` - Good for newcomers
- `help wanted` - Extra attention needed
- `documentation` - Documentation improvements
- `question` - Questions or discussions

## Security Considerations

1. **Directory Trust**: First-run security disclaimer for new directories
2. **API Keys**: Never commit API keys; use environment variables
3. **Tool Approval**: Potentially dangerous operations require confirmation
4. **Input Validation**: Always validate user inputs and tool arguments
5. **PII Redaction**: Automatic redaction in logs

## Key Commands for Development

```bash
# Setup
pnpm install                # Install dependencies
pnpm run build              # Build project

# Development
pnpm run dev                # Watch mode
pnpm run start              # Run application

# Quality checks
pnpm run test:all           # Full test suite
pnpm run test:lint:fix      # Fix linting issues
pnpm run test:types         # Type checking

# VS Code extension
pnpm run build:vscode       # Build extension
```

## Philosophy

- **Local-first**: Data, models, and processing stay on your machine
- **Privacy-focused**: User control and data security
- **Community-led**: Open collaboration, not corporate-controlled
- **Provider-agnostic**: Support any OpenAI-compatible API

## Getting Help

- **GitHub Issues**: Bug reports, feature requests
- **Discord**: Real-time community support at https://discord.gg/ktPDV6rekE
- **Documentation**: README.md, CONTRIBUTING.md, CLAUDE.md, AGENTS.md

## Notes for Copilot

When generating code or providing suggestions:
1. Follow strict TypeScript patterns with no `any` types
2. Use structured logging with context objects
3. Include comprehensive tests for new features
4. Respect the local-first, privacy-focused philosophy
5. Handle errors gracefully with proper user feedback
6. Use Ink.js patterns for CLI UI components
7. Follow the existing state management architecture
8. Maintain compatibility with multiple AI providers
