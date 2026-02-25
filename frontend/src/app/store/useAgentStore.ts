import { create } from "zustand";

import {
  API_BASE_URL,
  createWorkspaceFolder,
  deleteWorkspacePath,
  extractErrorMessage,
  fetchGraphSchema,
  fetchWorkspaceFiles,
  fetchWorkspaceTree,
  type GraphSchemaEdge,
  type GraphSchemaNode,
  type NodeId,
  readWorkspaceFile,
  renameWorkspacePath,
  type RunAgentRequest,
  type WorkspaceTreeNode,
  writeWorkspaceFile
} from "@/app/lib/api-client";
import { consumeSseStream } from "@/app/lib/sse";

type NodeState = "idle" | "active" | "completed" | "error";

export interface AgentLogEvent {
  id: string;
  event: string;
  event_id?: number;
  timestamp: string;
  node: string | null;
  state: NodeState | null;
  activity_score: number | null;
  severity: string;
  message: string;
  raw?: unknown;
  namespace?: unknown;
}

export interface StartAgentRunInput {
  userPrompt: string;
  model?: string;
  recursionLimit?: number;
  mutablePrompt?: string | null;
}

interface AgentStoreState {
  files: Record<string, string>;
  skippedBinary: string[];
  treeNodes: WorkspaceTreeNode[];
  graphNodes: GraphSchemaNode[];
  graphEdges: GraphSchemaEdge[];
  activeFilePath: string | null;
  activeNodeId: string | null;
  nodeStatusById: Record<string, NodeState>;
  activityByNodeId: Record<string, number>;
  logs: AgentLogEvent[];
  isGenerating: boolean;
  promptOverrides: Record<NodeId, string>;
  errorMessage: string | null;
  fetchFiles: () => Promise<void>;
  fetchTree: () => Promise<void>;
  fetchGraphSchema: () => Promise<void>;
  readFile: (path: string) => Promise<void>;
  updateFileContent: (path: string, content: string) => Promise<void>;
  createFolder: (path: string) => Promise<void>;
  renamePath: (fromPath: string, toPath: string, overwrite?: boolean) => Promise<void>;
  deletePath: (path: string, recursive?: boolean) => Promise<void>;
  startAgentRun: (input: StartAgentRunInput) => Promise<void>;
  syncSseEvent: (eventName: string, data: Record<string, unknown>) => void;
  downloadWorkspaceZip: () => Promise<void>;
  setActiveFilePath: (path: string | null) => void;
  setPromptOverride: (nodeId: NodeId, value: string) => void;
}

const NODE_IDS: NodeId[] = ["planner", "architect", "coder"];

function nowIso(): string {
  return new Date().toISOString();
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function toNodeState(value: unknown): NodeState | null {
  if (value === "idle" || value === "active" || value === "completed" || value === "error") {
    return value;
  }
  return null;
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

function getStoredApiKey(): string {
  const key =
    localStorage.getItem("X-API-KEY") ??
    localStorage.getItem("groq_api_key") ??
    localStorage.getItem("api_key") ??
    "";
  return key.trim();
}

function buildPromptOverrides(overrides: Record<NodeId, string>): Record<string, string> {
  const payload: Record<string, string> = {};
  for (const nodeId of NODE_IDS) {
    const value = overrides[nodeId]?.trim();
    if (value) {
      payload[nodeId] = value;
    }
  }
  return payload;
}

function pushStoreError(set: (fn: (state: AgentStoreState) => Partial<AgentStoreState>) => void, message: string) {
  set((state) => ({
    errorMessage: message,
    logs: [
      ...state.logs,
      {
        id: `${Date.now()}-${state.logs.length + 1}`,
        event: "error",
        timestamp: nowIso(),
        node: null,
        state: "error",
        activity_score: 0,
        severity: "error",
        message,
        raw: null
      }
    ]
  }));
}

async function readErrorPayload(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }

  try {
    return await response.text();
  } catch {
    return null;
  }
}

export const useAgentStore = create<AgentStoreState>((set, get) => ({
  files: {},
  skippedBinary: [],
  treeNodes: [],
  graphNodes: [],
  graphEdges: [],
  activeFilePath: null,
  activeNodeId: null,
  nodeStatusById: {
    planner: "idle",
    architect: "idle",
    coder: "idle"
  },
  activityByNodeId: {
    planner: 0,
    architect: 0,
    coder: 0
  },
  logs: [],
  isGenerating: false,
  promptOverrides: {
    planner: "",
    architect: "",
    coder: ""
  },
  errorMessage: null,
  fetchFiles: async () => {
    try {
      const response = await fetchWorkspaceFiles();
      const paths = Object.keys(response.files).sort();
      set((state) => ({
        files: response.files,
        skippedBinary: response.skipped_binary,
        activeFilePath:
          paths.length > 0
            ? state.activeFilePath && response.files[state.activeFilePath] !== undefined
              ? state.activeFilePath
              : paths[0]
            : null,
        errorMessage: null
      }));
    } catch (error) {
      pushStoreError(set, `Failed to load workspace files: ${String(error)}`);
    }
  },
  fetchTree: async () => {
    try {
      const response = await fetchWorkspaceTree();
      set({ treeNodes: response.nodes, errorMessage: null });
    } catch (error) {
      pushStoreError(set, `Failed to load workspace tree: ${String(error)}`);
    }
  },
  fetchGraphSchema: async () => {
    try {
      const response = await fetchGraphSchema();
      set({ graphNodes: response.nodes, graphEdges: response.edges, errorMessage: null });
    } catch (error) {
      pushStoreError(set, `Failed to load graph schema: ${String(error)}`);
    }
  },
  readFile: async (path: string) => {
    try {
      const response = await readWorkspaceFile(path);
      set((state) => ({
        files: {
          ...state.files,
          [response.path]: response.content
        },
        activeFilePath: response.path,
        errorMessage: null
      }));
    } catch (error) {
      pushStoreError(set, `Failed to read file '${path}': ${String(error)}`);
    }
  },
  updateFileContent: async (path: string, content: string) => {
    set((state) => ({
      files: {
        ...state.files,
        [path]: content
      }
    }));

    try {
      await writeWorkspaceFile(path, content);
      set({ errorMessage: null });
    } catch (error) {
      pushStoreError(set, `Failed to save file '${path}': ${String(error)}`);
      throw error;
    }
  },
  createFolder: async (path: string) => {
    try {
      await createWorkspaceFolder(path);
      await Promise.all([get().fetchTree(), get().fetchFiles()]);
      set({ errorMessage: null });
    } catch (error) {
      pushStoreError(set, `Failed to create folder '${path}': ${String(error)}`);
    }
  },
  renamePath: async (fromPath: string, toPath: string, overwrite = false) => {
    try {
      await renameWorkspacePath(fromPath, toPath, overwrite);
      await Promise.all([get().fetchTree(), get().fetchFiles()]);
      if (get().activeFilePath === fromPath) {
        set({ activeFilePath: toPath });
      }
      set({ errorMessage: null });
    } catch (error) {
      pushStoreError(set, `Failed to rename '${fromPath}' to '${toPath}': ${String(error)}`);
    }
  },
  deletePath: async (path: string, recursive = false) => {
    try {
      await deleteWorkspacePath(path, recursive);
      await Promise.all([get().fetchTree(), get().fetchFiles()]);
      if (get().activeFilePath === path) {
        set({ activeFilePath: null });
      }
      set({ errorMessage: null });
    } catch (error) {
      pushStoreError(set, `Failed to delete '${path}': ${String(error)}`);
    }
  },
  startAgentRun: async (input: StartAgentRunInput) => {
    const userPrompt = input.userPrompt.trim();
    if (!userPrompt) {
      pushStoreError(set, "Prompt cannot be empty.");
      return;
    }

    const localApiKey = getStoredApiKey();
    if (!localApiKey) {
      pushStoreError(set, "Missing API key. Set X-API-KEY in local storage before running.");
      return;
    }

    const requestPayload: RunAgentRequest = {
      user_prompt: userPrompt,
      model: input.model,
      recursion_limit: input.recursionLimit,
      mutable_prompt: input.mutablePrompt ?? null,
      prompt_overrides: buildPromptOverrides(get().promptOverrides),
      api_key: localApiKey
    };

    set({
      isGenerating: true,
      logs: [],
      activeNodeId: null,
      nodeStatusById: {
        planner: "idle",
        architect: "idle",
        coder: "idle"
      },
      activityByNodeId: {
        planner: 0,
        architect: 0,
        coder: 0
      },
      errorMessage: null
    });

    try {
      const response = await fetch(`${API_BASE_URL}/stream`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-KEY": localApiKey
        },
        body: JSON.stringify(requestPayload)
      });

      if (!response.ok) {
        const payload = await readErrorPayload(response);
        throw new Error(
          extractErrorMessage(payload, `Stream request failed with status ${response.status}`)
        );
      }

      await consumeSseStream(response, (event) => {
        get().syncSseEvent(event.event, event.data);
      });

      await Promise.all([get().fetchFiles(), get().fetchTree()]);
    } catch (error) {
      get().syncSseEvent("error", {
        event_id: Date.now(),
        timestamp: nowIso(),
        node: get().activeNodeId,
        state: "error",
        activity_score: 0,
        severity: "error",
        message: `Streaming failed: ${String(error)}`,
        raw: { error: String(error) }
      });
    } finally {
      set({ isGenerating: false });
    }
  },
  syncSseEvent: (eventName: string, data: Record<string, unknown>) => {
    const node = typeof data.node === "string" ? data.node : null;
    const state = toNodeState(data.state);
    const score = toNumber(data.activity_score);
    const emittedNodeStates = asRecord(data.node_states);
    const emittedActivityByNode = asRecord(data.activity_by_node_id);

    set((store) => {
      const nextNodeStatus = { ...store.nodeStatusById };
      const nextActivity = { ...store.activityByNodeId };

      for (const [key, value] of Object.entries(emittedNodeStates)) {
        const normalized = toNodeState(value);
        if (normalized) {
          nextNodeStatus[key] = normalized;
        }
      }

      for (const [key, value] of Object.entries(emittedActivityByNode)) {
        const normalized = toNumber(value);
        if (normalized !== null) {
          nextActivity[key] = normalized;
        }
      }

      if (node && state) {
        nextNodeStatus[node] = state;
      }
      if (node && score !== null) {
        nextActivity[node] = score;
      }

      const nextLog: AgentLogEvent = {
        id:
          typeof data.event_id === "number"
            ? String(data.event_id)
            : `${Date.now()}-${store.logs.length + 1}`,
        event: eventName,
        event_id: typeof data.event_id === "number" ? data.event_id : undefined,
        timestamp: typeof data.timestamp === "string" ? data.timestamp : nowIso(),
        node,
        state,
        activity_score: score,
        severity: typeof data.severity === "string" ? data.severity : "info",
        message:
          typeof data.message === "string"
            ? data.message
            : eventName === "on_chat_model_stream"
              ? "Streaming model output token."
              : eventName,
        raw: data.raw,
        namespace: data.namespace
      };

      return {
        logs: [...store.logs, nextLog],
        activeNodeId:
          eventName === "on_node_start" && node
            ? node
            : eventName === "run_complete" || eventName === "error"
              ? null
              : eventName === "on_node_end" && node === store.activeNodeId
                ? null
                : store.activeNodeId,
        nodeStatusById: nextNodeStatus,
        activityByNodeId: nextActivity,
        isGenerating:
          eventName === "run_complete" || eventName === "error" ? false : store.isGenerating,
        errorMessage:
          eventName === "error"
            ? typeof data.message === "string"
              ? data.message
              : "Workflow failed."
            : store.errorMessage
      };
    });
  },
  downloadWorkspaceZip: async () => {
    const localApiKey = getStoredApiKey();
    try {
      const response = await fetch(`${API_BASE_URL}/workspace/download`, {
        headers: localApiKey ? { "X-API-KEY": localApiKey } : undefined
      });
      if (!response.ok) {
        const payload = await readErrorPayload(response);
        throw new Error(
          extractErrorMessage(payload, `Download failed with status ${response.status}`)
        );
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "generated_project.zip";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      pushStoreError(set, `Failed to download workspace zip: ${String(error)}`);
    }
  },
  setActiveFilePath: (path: string | null) => {
    set({ activeFilePath: path });
  },
  setPromptOverride: (nodeId: NodeId, value: string) => {
    set((state) => ({
      promptOverrides: {
        ...state.promptOverrides,
        [nodeId]: value
      }
    }));
  }
}));
