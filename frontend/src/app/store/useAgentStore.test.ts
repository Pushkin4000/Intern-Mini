import { beforeEach, describe, expect, it, vi } from "vitest";

const apiMocks = vi.hoisted(() => ({
  fetchWorkspaceFiles: vi.fn(),
  fetchWorkspaceTree: vi.fn(),
  fetchGraphSchema: vi.fn(),
  readWorkspaceFile: vi.fn(),
  writeWorkspaceFile: vi.fn(),
  createWorkspaceFolder: vi.fn(),
  renameWorkspacePath: vi.fn(),
  deleteWorkspacePath: vi.fn(),
}));

const sseMocks = vi.hoisted(() => ({
  consumeSseStream: vi.fn(),
}));

vi.mock("@/app/lib/api-client", () => ({
  API_BASE_URL: "http://localhost:8000",
  extractErrorMessage: (payload: unknown, fallback = "Request failed.") => {
    if (payload && typeof payload === "object" && !Array.isArray(payload)) {
      const errorObj = payload as { error?: { message?: string } };
      if (errorObj.error?.message) {
        return errorObj.error.message;
      }
    }
    return typeof payload === "string" && payload ? payload : fallback;
  },
  fetchWorkspaceFiles: apiMocks.fetchWorkspaceFiles,
  fetchWorkspaceTree: apiMocks.fetchWorkspaceTree,
  fetchGraphSchema: apiMocks.fetchGraphSchema,
  readWorkspaceFile: apiMocks.readWorkspaceFile,
  writeWorkspaceFile: apiMocks.writeWorkspaceFile,
  createWorkspaceFolder: apiMocks.createWorkspaceFolder,
  renameWorkspacePath: apiMocks.renameWorkspacePath,
  deleteWorkspacePath: apiMocks.deleteWorkspacePath,
}));

vi.mock("@/app/lib/sse", () => ({
  consumeSseStream: sseMocks.consumeSseStream,
}));

import { useAgentStore } from "@/app/store/useAgentStore";

function createMemoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear() {
      data.clear();
    },
    getItem(key: string) {
      return data.has(key) ? data.get(key)! : null;
    },
    key(index: number) {
      return Array.from(data.keys())[index] ?? null;
    },
    removeItem(key: string) {
      data.delete(key);
    },
    setItem(key: string, value: string) {
      data.set(key, String(value));
    },
  };
}

function resetStore() {
  useAgentStore.setState({
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
      coder: "idle",
    },
    activityByNodeId: {
      planner: 0,
      architect: 0,
      coder: 0,
    },
    logs: [],
    isGenerating: false,
    promptOverrides: {
      planner: "",
      architect: "",
      coder: "",
    },
    errorMessage: null,
  });
}

describe("useAgentStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("localStorage", createMemoryStorage());
    localStorage.clear();
    resetStore();

    apiMocks.fetchWorkspaceFiles.mockResolvedValue({
      files: {},
      skipped_binary: [],
    });
    apiMocks.fetchWorkspaceTree.mockResolvedValue({
      root: "generated_project",
      nodes: [],
    });
    apiMocks.fetchGraphSchema.mockResolvedValue({
      graph_id: "agent_mind_v1",
      nodes: [],
      edges: [],
      state_model: ["idle", "active", "completed", "error"],
      activity_model: { min: 0, max: 1 },
    });
    apiMocks.readWorkspaceFile.mockResolvedValue({
      path: "README.md",
      content: "# Hello",
    });
    apiMocks.writeWorkspaceFile.mockResolvedValue({
      path: "README.md",
      content: "# Hello",
    });
    apiMocks.createWorkspaceFolder.mockResolvedValue({ path: "src" });
    apiMocks.renameWorkspacePath.mockResolvedValue({ path: "src/main.py" });
    apiMocks.deleteWorkspacePath.mockResolvedValue({ path: "src/main.py" });
  });

  it("updates node status and activity via syncSseEvent", () => {
    const store = useAgentStore.getState();
    useAgentStore.setState({ isGenerating: true });

    store.syncSseEvent("on_node_start", {
      event_id: 1,
      timestamp: "2026-02-25T00:00:00Z",
      node: "planner",
      state: "active",
      activity_score: 1.0,
      severity: "info",
      message: "Node planner active.",
    });

    let state = useAgentStore.getState();
    expect(state.activeNodeId).toBe("planner");
    expect(state.nodeStatusById.planner).toBe("active");
    expect(state.activityByNodeId.planner).toBe(1.0);

    store.syncSseEvent("on_node_end", {
      event_id: 2,
      timestamp: "2026-02-25T00:00:01Z",
      node: "planner",
      state: "completed",
      activity_score: 0.2,
      severity: "info",
      message: "Node planner completed.",
    });

    store.syncSseEvent("run_complete", {
      event_id: 3,
      timestamp: "2026-02-25T00:00:02Z",
      severity: "info",
      message: "Workflow finished successfully.",
    });

    state = useAgentStore.getState();
    expect(state.activeNodeId).toBeNull();
    expect(state.nodeStatusById.planner).toBe("completed");
    expect(state.isGenerating).toBe(false);
    expect(state.logs).toHaveLength(3);
  });

  it("runs startAgentRun and consumes SSE events", async () => {
    localStorage.setItem("X-API-KEY", "test-api-key");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("", {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    sseMocks.consumeSseStream.mockImplementation(async (_response, onEvent) => {
      onEvent({
        event: "on_node_start",
        data: {
          event_id: 1,
          timestamp: "2026-02-25T00:00:00Z",
          node: "planner",
          state: "active",
          activity_score: 1.0,
          severity: "info",
          message: "Node planner active.",
          node_states: {
            planner: "active",
            architect: "idle",
            coder: "idle",
          },
          activity_by_node_id: {
            planner: 1.0,
            architect: 0.0,
            coder: 0.0,
          },
        },
      });
      onEvent({
        event: "run_complete",
        data: {
          event_id: 2,
          timestamp: "2026-02-25T00:00:01Z",
          severity: "info",
          message: "Workflow finished successfully.",
        },
      });
    });

    await useAgentStore.getState().startAgentRun({
      userPrompt: "Build a simple API.",
    });

    const state = useAgentStore.getState();
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/stream",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "X-API-KEY": "test-api-key",
        }),
      })
    );
    expect(sseMocks.consumeSseStream).toHaveBeenCalledTimes(1);
    expect(state.logs.some((entry) => entry.event === "run_complete")).toBe(true);
    expect(state.nodeStatusById.planner).toBe("active");
    expect(state.isGenerating).toBe(false);

  });

  it("records a descriptive error when workspace fetch fails", async () => {
    apiMocks.fetchWorkspaceFiles.mockRejectedValueOnce(new Error("workspace unavailable"));

    await useAgentStore.getState().fetchFiles();

    const state = useAgentStore.getState();
    expect(state.errorMessage).toContain("workspace unavailable");
    expect(state.logs.at(-1)?.event).toBe("error");
  });
});
