import { useAgentStore } from "@/store/useAgentStore";

describe("useAgentStore.syncSseEvent", () => {
  beforeEach(() => {
    useAgentStore.setState({
      activeNodeId: null,
      isGenerating: true,
      logs: [],
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
  });

  it("marks node active on on_node_start", () => {
    useAgentStore.getState().syncSseEvent("on_node_start", {
      node: "planner",
      state: "active",
      activity_score: 1
    });

    const state = useAgentStore.getState();
    expect(state.activeNodeId).toBe("planner");
    expect(state.nodeStatusById.planner).toBe("active");
    expect(state.activityByNodeId.planner).toBe(1);
  });

  it("marks run as finished on run_complete", () => {
    useAgentStore.getState().syncSseEvent("run_complete", {
      state: null,
      activity_score: 0
    });

    const state = useAgentStore.getState();
    expect(state.activeNodeId).toBeNull();
    expect(state.isGenerating).toBe(false);
  });
});
