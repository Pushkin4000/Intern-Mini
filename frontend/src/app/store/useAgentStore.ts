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
import { getStoredApiKey } from "@/app/lib/api-key-storage";
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
const WORKFLOW_NODE_ID_SET = new Set<string>(NODE_IDS);

function nowIso(): string {
  return new Date().toISOString();
}

function isWorkflowNode(nodeId: unknown): nodeId is NodeId {
  return typeof nodeId === "string" && WORKFLOW_NODE_ID_SET.has(nodeId);
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

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return String(error);
}

function isWorkspaceAuthError(error: unknown): boolean {
  const message = toErrorMessage(error).toLowerCase();
  return (
    message.includes("workspace_unauthorized") ||
    message.includes("workspace api authentication required") ||
    (message.includes("workspace") && message.includes("x-api-key"))
  );
}

function setWorkspaceAuthBlocked(setState: (value: Partial<AgentStoreState>) => void): void {
  setState({
    errorMessage: "Workspace access requires an API key. Add your key to continue.",
  });
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

function deriveActiveNodeId(nodeStatusById: Record<string, NodeState>): string | null {
  for (const nodeId of NODE_IDS) {
    if (nodeStatusById[nodeId] === "active") {
      return nodeId;
    }
  }
  return null;
}

function shouldDisplayLogEvent(
  eventName: string,
  node: string | null,
  severity: string
): boolean {
  if (severity === "warn" || severity === "error") {
    return true;
  }
  if (eventName === "run_started" || eventName === "run_complete" || eventName === "error") {
    return true;
  }
  if ((eventName === "on_node_start" || eventName === "on_node_end") && isWorkflowNode(node)) {
    return true;
  }
  return false;
}

function buildDisplayLogMessage(
  eventName: string,
  node: string | null,
  data: Record<string, unknown>
): string {
  const details = toObjectOrNull(data.details);
  const iteration = toInteger(data.iteration);
  const iterationSuffix = typeof iteration === "number" ? ` (iteration ${iteration})` : "";
  const nodeLabel = node ? `${node[0]?.toUpperCase() ?? ""}${node.slice(1)}` : "Workflow";
  const rawMessage = typeof data.message === "string" ? data.message.trim() : "";

  if (eventName === "run_started") {
    return "Workflow run started.";
  }
  if (eventName === "run_complete") {
    return "Workflow finished successfully.";
  }
  if (eventName === "on_node_start" && node) {
    return `${nodeLabel} started${iterationSuffix}.`;
  }
  if (eventName === "on_node_end" && node) {
    const summary = typeof details?.text === "string" ? details.text.trim() : "";
    if (summary) {
      return `${nodeLabel} completed${iterationSuffix}: ${summary}.`;
    }
    return `${nodeLabel} completed${iterationSuffix}.`;
  }
  if (rawMessage) {
    return rawMessage;
  }
  return `${nodeLabel}: ${eventName}`;
}

function buildLogDetails(data: Record<string, unknown>): Record<string, unknown> | null {
  const details = toObjectOrNull(data.details);
  const raw = data.raw;
  if (details && raw !== undefined) {
    return { ...details, raw };
  }
  if (details) {
    return details;
  }
  if (raw !== undefined) {
    return { raw };
  }
  return null;
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
      if (isWorkspaceAuthError(error)) {
        setWorkspaceAuthBlocked(set);
        return;
      }
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
      if (isWorkspaceAuthError(error)) {
        setWorkspaceAuthBlocked(set);
        return;
      }
      pushStoreError(set, `Failed to reset workspace session: ${String(error)}`);
    }
  },
  fetchFiles: async () => {
    try {
      if (!get().workspaceId) {
        await get().initWorkspaceSession();
        if (!get().workspaceId) {
          return;
        }
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
      if (isWorkspaceAuthError(error)) {
        setWorkspaceAuthBlocked(set);
        return;
      }
      pushStoreError(set, `Failed to load workspace files: ${String(error)}`);
    }
  },
  fetchTree: async () => {
    try {
      if (!get().workspaceId) {
        await get().initWorkspaceSession();
        if (!get().workspaceId) {
          return;
        }
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
      if (isWorkspaceAuthError(error)) {
        setWorkspaceAuthBlocked(set);
        return;
      }
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
        if (!get().workspaceId) {
          return;
        }
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
      if (isWorkspaceAuthError(error)) {
        setWorkspaceAuthBlocked(set);
        return;
      }
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
        if (!get().workspaceId) {
          throw new Error("Workspace session is not available.");
        }
      }
      const response = await writeWorkspaceFile(path, content);
      setWorkspaceId(response.workspace_id);
      set({
        workspaceId: response.workspace_id,
        workspaceExpiresAt: response.expires_at,
        errorMessage: null,
      });
    } catch (error) {
      if (isWorkspaceAuthError(error)) {
        setWorkspaceAuthBlocked(set);
        throw error;
      }
      pushStoreError(set, `Failed to save file '${path}': ${String(error)}`);
      throw error;
    }
  },
  createFolder: async (path: string) => {
    try {
      if (!get().workspaceId) {
        await get().initWorkspaceSession();
        if (!get().workspaceId) {
          return;
        }
      }
      await createWorkspaceFolder(path);
      await Promise.all([get().fetchTree(), get().fetchFiles()]);
      set({ errorMessage: null });
    } catch (error) {
      if (isWorkspaceAuthError(error)) {
        setWorkspaceAuthBlocked(set);
        return;
      }
      pushStoreError(set, `Failed to create folder '${path}': ${String(error)}`);
    }
  },
  renamePath: async (fromPath: string, toPath: string, overwrite = false) => {
    try {
      if (!get().workspaceId) {
        await get().initWorkspaceSession();
        if (!get().workspaceId) {
          return;
        }
      }
      await renameWorkspacePath(fromPath, toPath, overwrite);
      await Promise.all([get().fetchTree(), get().fetchFiles()]);
      if (get().activeFilePath === fromPath) {
        set({ activeFilePath: toPath });
      }
      set({ errorMessage: null });
    } catch (error) {
      if (isWorkspaceAuthError(error)) {
        setWorkspaceAuthBlocked(set);
        return;
      }
      pushStoreError(set, `Failed to rename '${fromPath}' to '${toPath}': ${String(error)}`);
    }
  },
  deletePath: async (path: string, recursive = false) => {
    try {
      if (!get().workspaceId) {
        await get().initWorkspaceSession();
        if (!get().workspaceId) {
          return;
        }
      }
      await deleteWorkspacePath(path, recursive);
      await Promise.all([get().fetchTree(), get().fetchFiles()]);
      if (get().activeFilePath === path) {
        set({ activeFilePath: null });
      }
      set({ errorMessage: null });
    } catch (error) {
      if (isWorkspaceAuthError(error)) {
        setWorkspaceAuthBlocked(set);
        return;
      }
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
      pushStoreError(set, "Missing API key. Add an API key in session storage or enable remember-key mode.");
      return;
    }

    if (!get().workspaceId) {
      await get().initWorkspaceSession();
      if (!get().workspaceId) {
        pushStoreError(set, "Workspace session is not available.");
        return;
      }
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
    const workflowNode = isWorkflowNode(node) ? node : null;
    const state = toNodeState(data.state);
    const score = toNumber(data.activity_score);
    const severity = typeof data.severity === "string" ? data.severity : "info";
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
        if (!isWorkflowNode(key)) {
          continue;
        }
        const normalized = toNodeState(value);
        if (normalized) {
          nextNodeStatus[key] = normalized;
        }
      }

      for (const [key, value] of Object.entries(emittedActivityByNode)) {
        if (!isWorkflowNode(key)) {
          continue;
        }
        const normalized = toNumber(value);
        if (normalized !== null) {
          nextActivity[key] = normalized;
        }
      }

      if (workflowNode && state) {
        nextNodeStatus[workflowNode] = state;
        
        // Auto-complete previous nodes
        if (state === "active") {
          if (workflowNode === "architect") {
            if (nextNodeStatus["planner"] !== "error") nextNodeStatus["planner"] = "completed";
          } else if (workflowNode === "coder") {
            if (nextNodeStatus["planner"] !== "error") nextNodeStatus["planner"] = "completed";
            if (nextNodeStatus["architect"] !== "error") nextNodeStatus["architect"] = "completed";
          }
        }
      }
      if (workflowNode && score !== null) {
        nextActivity[workflowNode] = score;
      }

      if (eventName === "run_complete") {
        for (const nodeId of NODE_IDS) {
          if (nextNodeStatus[nodeId] === "active") {
            nextNodeStatus[nodeId] = "completed";
          }
        }
      }
      if (eventName === "error") {
        const activeNodeId = deriveActiveNodeId(nextNodeStatus);
        if (activeNodeId) {
          nextNodeStatus[activeNodeId] = "error";
          nextActivity[activeNodeId] = 0;
        }
      }

      const includeLog = shouldDisplayLogEvent(eventName, node, severity);

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
        severity,
        message: buildDisplayLogMessage(eventName, node, data),
        details: buildLogDetails(data),
        hint: typeof data.hint === "string" ? data.hint : null,
        error_type: typeof data.error_type === "string" ? data.error_type : null,
        iteration: toInteger(data.iteration),
        duration_ms: toInteger(data.duration_ms),
        raw: data.raw,
        namespace: data.namespace
      };

      return {
        workspaceId: workspaceId ?? store.workspaceId,
        logs: includeLog ? [...store.logs, nextLog] : store.logs,
        activeNodeId: deriveActiveNodeId(nextNodeStatus),
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
      if (!get().workspaceId) {
        return;
      }
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
      if (isWorkspaceAuthError(error)) {
        setWorkspaceAuthBlocked(set);
        return;
      }
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
