"use client";

import { create } from "zustand";

import {
  createWorkspaceFolder,
  deleteWorkspacePath,
  fetchGraphSchema,
  fetchWorkspaceFiles,
  fetchWorkspaceTree,
  GraphSchemaEdge,
  GraphSchemaNode,
  NodeId,
  readWorkspaceFile,
  renameWorkspacePath,
  RunAgentRequest,
  WorkspaceTreeNode,
  workspaceDownloadUrl,
  writeWorkspaceFile
} from "@/lib/api-client";
import { consumeSseStream } from "@/lib/sse";

type NodeState = "idle" | "active" | "completed" | "error";

export interface AgentLogEvent {
  event: string;
  event_id?: number;
  timestamp?: string;
  node?: string | null;
  state?: string | null;
  activity_score?: number | null;
  severity?: string;
  message?: string;
  raw?: unknown;
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
  downloadWorkspaceZip: () => void;
  setActiveFilePath: (path: string | null) => void;
  setPromptOverride: (nodeId: NodeId, value: string) => void;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
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
  fetchFiles: async () => {
    const response = await fetchWorkspaceFiles();
    const paths = Object.keys(response.files).sort();
    set({
      files: response.files,
      skippedBinary: response.skipped_binary,
      activeFilePath: paths.length ? get().activeFilePath ?? paths[0] : null
    });
  },
  fetchTree: async () => {
    const response = await fetchWorkspaceTree();
    set({ treeNodes: response.nodes });
  },
  fetchGraphSchema: async () => {
    const response = await fetchGraphSchema();
    set({
      graphNodes: response.nodes,
      graphEdges: response.edges
    });
  },
  readFile: async (path: string) => {
    const response = await readWorkspaceFile(path);
    set((state) => ({
      files: {
        ...state.files,
        [response.path]: response.content
      },
      activeFilePath: response.path
    }));
  },
  updateFileContent: async (path: string, content: string) => {
    set((state) => ({
      files: {
        ...state.files,
        [path]: content
      }
    }));
    await writeWorkspaceFile(path, content);
  },
  createFolder: async (path: string) => {
    await createWorkspaceFolder(path);
    await Promise.all([get().fetchTree(), get().fetchFiles()]);
  },
  renamePath: async (fromPath: string, toPath: string, overwrite = false) => {
    await renameWorkspacePath(fromPath, toPath, overwrite);
    await Promise.all([get().fetchTree(), get().fetchFiles()]);
    if (get().activeFilePath === fromPath) {
      set({ activeFilePath: toPath });
    }
  },
  deletePath: async (path: string, recursive = false) => {
    await deleteWorkspacePath(path, recursive);
    await Promise.all([get().fetchTree(), get().fetchFiles()]);
    if (get().activeFilePath === path) {
      set({ activeFilePath: null });
    }
  },
  startAgentRun: async (input: StartAgentRunInput) => {
    const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
    const localApiKey = typeof window !== "undefined" ? localStorage.getItem("X-API-KEY") : null;
    const overrides = get().promptOverrides;
    const requestPayload: RunAgentRequest = {
      user_prompt: input.userPrompt,
      model: input.model,
      recursion_limit: input.recursionLimit,
      mutable_prompt: input.mutablePrompt ?? null,
      prompt_overrides: overrides,
      api_key: localApiKey ?? undefined
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
      }
    });

    const headers: Record<string, string> = {
      "Content-Type": "application/json"
    };
    if (localApiKey) {
      headers["X-API-KEY"] = localApiKey;
    }

    try {
      const response = await fetch(`${apiBase}/stream`, {
        method: "POST",
        headers,
        body: JSON.stringify(requestPayload)
      });

      await consumeSseStream(response, (event) => {
        get().syncSseEvent(event.event, event.data);
      });
    } finally {
      set({ isGenerating: false });
    }
  },
  syncSseEvent: (eventName: string, data: Record<string, unknown>) => {
    const node = typeof data.node === "string" ? data.node : null;
    const state = typeof data.state === "string" ? data.state : null;
    const score =
      typeof data.activity_score === "number"
        ? data.activity_score
        : typeof data.activity_score === "string"
          ? Number(data.activity_score)
          : null;

    set((store) => {
      const nextNodeStatus = { ...store.nodeStatusById };
      const nextActivity = { ...store.activityByNodeId };

      const emittedNodeStates = asRecord(data.node_states);
      const emittedActivityByNode = asRecord(data.activity_by_node_id);

      for (const [key, value] of Object.entries(emittedNodeStates)) {
        if (value === "idle" || value === "active" || value === "completed" || value === "error") {
          nextNodeStatus[key] = value;
        }
      }
      for (const [key, value] of Object.entries(emittedActivityByNode)) {
        if (typeof value === "number") {
          nextActivity[key] = value;
        }
      }

      if (node && state && (state === "idle" || state === "active" || state === "completed" || state === "error")) {
        nextNodeStatus[node] = state;
      }
      if (node && typeof score === "number" && Number.isFinite(score)) {
        nextActivity[node] = score;
      }

      const nextLog: AgentLogEvent = {
        event: eventName,
        event_id: typeof data.event_id === "number" ? data.event_id : undefined,
        timestamp: typeof data.timestamp === "string" ? data.timestamp : undefined,
        node,
        state,
        activity_score: score,
        severity: typeof data.severity === "string" ? data.severity : undefined,
        message: typeof data.message === "string" ? data.message : undefined,
        raw: data.raw
      };

      return {
        logs: [...store.logs, nextLog],
        activeNodeId:
          eventName === "on_node_start"
            ? node
            : eventName === "on_node_end" && store.activeNodeId === node
              ? null
              : eventName === "run_complete" || eventName === "error"
                ? null
                : store.activeNodeId,
        nodeStatusById: nextNodeStatus,
        activityByNodeId: nextActivity,
        isGenerating:
          eventName === "run_complete" || eventName === "error" ? false : store.isGenerating
      };
    });
  },
  downloadWorkspaceZip: () => {
    const link = document.createElement("a");
    link.href = workspaceDownloadUrl();
    link.download = "generated_project.zip";
    document.body.appendChild(link);
    link.click();
    link.remove();
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
