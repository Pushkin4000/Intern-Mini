# Figma Stitching Contract

This project exposes a logic-first integration contract so your Figma components can bind directly to backend and Zustand actions.

## Required Mount IDs

Use these IDs in your layout so logic wrappers can target consistent slots:

- `agent-file-tree`
- `agent-editor`
- `agent-graph`
- `agent-logs`
- `agent-run-button`
- `agent-download-button`
- `agent-user-prompt` (input/textarea for run prompt text)

## Required Data Attributes

Attach these attributes to Figma-exported interactive elements:

- `data-agent-action`
- `data-agent-file-path`
- `data-agent-node`
- `data-agent-source-id` (for save actions reading content from a specific input/textarea)

## Supported `data-agent-action` Values

- `run-agent`
- `refresh-files`
- `download-zip`
- `open-file`
- `save-file`

## Action Mapping

- `run-agent`
  - Reads prompt text from `#agent-user-prompt`
  - Calls `useAgentStore.getState().startAgentRun(...)`
- `refresh-files`
  - Calls `fetchFiles()` and `fetchTree()`
- `download-zip`
  - Calls `downloadWorkspaceZip()`
- `open-file`
  - Requires `data-agent-file-path`
  - Calls `readFile(path)`
- `save-file`
  - Requires `data-agent-file-path` and `data-agent-source-id`
  - Reads value from the source element and calls `updateFileContent(path, value)`

## Zustand Source of Truth

All global app data must come from `frontend/src/app/store/useAgentStore.ts`:

- `files`
- `activeFilePath`
- `activeNodeId`
- `logs`
- `isGenerating`
- `promptOverrides`
- `nodeStatusById`
- `activityByNodeId`

Do not duplicate these values in local component state for cross-panel synchronization.

## Stream Event Contract (Consumed by Store)

The store expects backend SSE payloads with:

- `event_id`
- `timestamp`
- `node`
- `state`
- `activity_score`
- `severity`
- `message`
- `raw`
- `node_states`
- `activity_by_node_id`

These are already emitted by `/stream`.

## Frontend Logic Paths

- API client: `frontend/src/app/lib/api-client.ts`
- SSE parser: `frontend/src/app/lib/sse.ts`
- Global store: `frontend/src/app/store/useAgentStore.ts`
- Main stitched screen: `frontend/src/app/pages/LiveStudio.tsx`

## Workspace API Endpoints Used by Frontend

- `GET /workspace/tree`
- `GET /workspace/files`
- `GET /workspace/file`
- `PUT /workspace/file`
- `POST /workspace/folder`
- `POST /workspace/rename`
- `DELETE /workspace/path`
- `GET /workspace/download`
