import { create } from "zustand";

import {
  API_BASE_URL,
  createWorkspaceSession,
  createWorkspaceFolder,
  deleteWorkspaceSession,
  deleteWorkspacePath,
  extractErrorMessage,
  fetchGraphSchema,
  fetchPromptSchema,
  fetchWorkspaceFiles,
  fetchWorkspaceTree,
  getWorkspaceId,
  type GraphSchemaEdge,
  type GraphSchemaNode,
  type NodeId,
  type PromptSchemaResponse,
  readWorkspaceFile,
  renameWorkspacePath,
  type RunAgentRequest,
  setWorkspaceId,
  touchWorkspaceSession,
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
  workspace_id?: string;
  node: string | null;
  state: NodeState | null;
  activity_score: number | null;
  severity: string;
  message: string;
  details?: Record<string, unknown> | null;
  hint?: string | null;
  error_type?: string | null;
  iteration?: number | null;
  duration_ms?: number | null;
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
  workspaceId: string | null;
  workspaceExpiresAt: string | null;
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
  promptSchema: PromptSchemaResponse | null;
  maxMutablePromptChars: number;
  immutableRules: string[];
  errorMessage: string | null;
  initWorkspaceSession: () => Promise<void>;
  resetWorkspaceSession: () => Promise<void>;
  fetchFiles: () => Promise<void>;
  fetchTree: () => Promise<void>;
  fetchGraphSchema: () => Promise<void>;
  fetchPromptSchema: () => Promise<void>;
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

function toInteger(value: unknown): number | null {
  const numeric = toNumber(value);
  if (numeric === null) {
    return null;
  }
  return Number.isInteger(numeric) ? numeric : Math.round(numeric);
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

function toObjectOrNull(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function shouldLogTokenEvent(data: Record<string, unknown>): boolean {
  const details = toObjectOrNull(data.details);
  const tokenIndex = toInteger(details?.token_index);
  const token = typeof data.token === "string" ? data.token : "";
  if (tokenIndex === null) {
    return token.trim().length > 0;
  }
  if (tokenIndex % 25 === 0) {
    return true;
  }
  if (token.includes("\n")) {
    return true;
  }
  return /[.!?]$/.test(token.trim());
}

export const useAgentStore = create<AgentStoreState>((set, get) => ({
  workspaceId: null,
  workspaceExpiresAt: null,
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
  promptSchema: null,
  maxMutablePromptChars: 4000,
  immutableRules: [],
  errorMessage: null,
  initWorkspaceSession: async () => {
    try {
      const existingWorkspaceId = get().workspaceId ?? getWorkspaceId();
      if (existingWorkspaceId) {
        const touched = await touchWorkspaceSession(existingWorkspaceId);
        setWorkspaceId(touched.workspace_id);
        set({
          workspaceId: touched.workspace_id,
          workspaceExpiresAt: touched.expires_at,
          errorMessage: null,
        });
        return;
      }

      const created = await createWorkspaceSession();
      setWorkspaceId(created.workspace_id);
      set({
        workspaceId: created.workspace_id,
        workspaceExpiresAt: created.expires_at,
        errorMessage: null,
      });
    } catch (error) {
      pushStoreError(set, `Failed to initialize workspace session: ${String(error)}`);
    }
  },
  resetWorkspaceSession: async () => {
    try {
      const previousWorkspaceId = get().workspaceId;
      if (previousWorkspaceId) {
        await deleteWorkspaceSession(previousWorkspaceId);
      }

      const created = await createWorkspaceSession();
      setWorkspaceId(created.workspace_id);
      set({
        workspaceId: created.workspace_id,
        workspaceExpiresAt: created.expires_at,
        files: {},
        treeNodes: [],
        activeFilePath: null,
        skippedBinary: [],
        logs: [],
        errorMessage: null,
      });
    } catch (error) {
      pushStoreError(set, `Failed to reset workspace session: ${String(error)}`);
    }
  },
  fetchFiles: async () => {
    try {
      if (!get().workspaceId) {
        await get().initWorkspaceSession();
      }
      const response = await fetchWorkspaceFiles();
      const paths = Object.keys(response.files).sort();
      setWorkspaceId(response.workspace_id);
      set((state) => ({
        workspaceId: response.workspace_id,
        workspaceExpiresAt: response.expires_at,
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
      if (!get().workspaceId) {
        await get().initWorkspaceSession();
      }
      const response = await fetchWorkspaceTree();
      setWorkspaceId(response.workspace_id);
      set({
        workspaceId: response.workspace_id,
        workspaceExpiresAt: response.expires_at,
        treeNodes: response.nodes,
        errorMessage: null,
      });
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
  fetchPromptSchema: async () => {
    try {
      const response = await fetchPromptSchema();
      set({
        promptSchema: response,
        maxMutablePromptChars: response.policy.max_mutable_prompt_chars,
        immutableRules: response.policy.immutable_rules,
        errorMessage: null,
      });
    } catch (error) {
      pushStoreError(set, `Failed to load prompt schema: ${String(error)}`);
    }
  },
  readFile: async (path: string) => {
    try {
      if (!get().workspaceId) {
        await get().initWorkspaceSession();
      }
      const response = await readWorkspaceFile(path);
      setWorkspaceId(response.workspace_id);
      set((state) => ({
        workspaceId: response.workspace_id,
        workspaceExpiresAt: response.expires_at,
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
      if (!get().workspaceId) {
        await get().initWorkspaceSession();
      }
      const response = await writeWorkspaceFile(path, content);
      setWorkspaceId(response.workspace_id);
      set({
        workspaceId: response.workspace_id,
        workspaceExpiresAt: response.expires_at,
        errorMessage: null,
      });
    } catch (error) {
      pushStoreError(set, `Failed to save file '${path}': ${String(error)}`);
      throw error;
    }
  },
  createFolder: async (path: string) => {
    try {
      if (!get().workspaceId) {
        await get().initWorkspaceSession();
      }
      await createWorkspaceFolder(path);
      await Promise.all([get().fetchTree(), get().fetchFiles()]);
      set({ errorMessage: null });
    } catch (error) {
      pushStoreError(set, `Failed to create folder '${path}': ${String(error)}`);
    }
  },
  renamePath: async (fromPath: string, toPath: string, overwrite = false) => {
    try {
      if (!get().workspaceId) {
        await get().initWorkspaceSession();
      }
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
      if (!get().workspaceId) {
        await get().initWorkspaceSession();
      }
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

    if (!get().workspaceId) {
      await get().initWorkspaceSession();
    }
    const workspaceId = get().workspaceId;

    const requestPayload: RunAgentRequest = {
      user_prompt: userPrompt,
      model: input.model,
      recursion_limit: input.recursionLimit,
      mutable_prompt: input.mutablePrompt ?? null,
      prompt_overrides: buildPromptOverrides(get().promptOverrides),
      workspace_id: workspaceId,
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
          "X-API-KEY": localApiKey,
          ...(workspaceId ? { "X-Workspace-ID": workspaceId } : {}),
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
    const workspaceId = typeof data.workspace_id === "string" ? data.workspace_id : null;
    if (workspaceId) {
      setWorkspaceId(workspaceId);
    }
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

      const skipTokenLog =
        eventName === "on_chat_model_stream" && !shouldLogTokenEvent(data);

      const nextLog: AgentLogEvent = {
        id:
          typeof data.event_id === "number"
            ? String(data.event_id)
            : `${Date.now()}-${store.logs.length + 1}`,
        event: eventName,
        event_id: typeof data.event_id === "number" ? data.event_id : undefined,
        timestamp: typeof data.timestamp === "string" ? data.timestamp : nowIso(),
        workspace_id: workspaceId ?? undefined,
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
        details: toObjectOrNull(data.details),
        hint: typeof data.hint === "string" ? data.hint : null,
        error_type: typeof data.error_type === "string" ? data.error_type : null,
        iteration: toInteger(data.iteration),
        duration_ms: toInteger(data.duration_ms),
        raw: data.raw,
        namespace: data.namespace
      };

      return {
        workspaceId: workspaceId ?? store.workspaceId,
        logs: skipTokenLog ? store.logs : [...store.logs, nextLog],
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
    if (!get().workspaceId) {
      await get().initWorkspaceSession();
    }
    const workspaceId = get().workspaceId;
    try {
      const response = await fetch(`${API_BASE_URL}/workspace/download`, {
        headers: {
          ...(localApiKey ? { "X-API-KEY": localApiKey } : {}),
          ...(workspaceId ? { "X-Workspace-ID": workspaceId } : {}),
        },
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
