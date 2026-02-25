"use client";

import { useEffect, useMemo } from "react";
import ReactFlow, { Background, Controls, Edge, MiniMap, Node } from "reactflow";
import "reactflow/dist/style.css";

import { useAgentStore } from "@/store/useAgentStore";

interface AgentGraphBridgeProps {
  height?: string;
  className?: string;
}

export function AgentGraphBridge({ height = "360px", className }: AgentGraphBridgeProps) {
  const graphNodes = useAgentStore((state) => state.graphNodes);
  const graphEdges = useAgentStore((state) => state.graphEdges);
  const nodeStatusById = useAgentStore((state) => state.nodeStatusById);
  const activityByNodeId = useAgentStore((state) => state.activityByNodeId);
  const fetchSchema = useAgentStore((state) => state.fetchGraphSchema);

  useEffect(() => {
    if (!graphNodes.length) {
      void fetchSchema();
    }
  }, [fetchSchema, graphNodes.length]);

  const nodes: Node[] = useMemo(() => {
    return graphNodes.map((node) => {
      const status = nodeStatusById[node.id] ?? "idle";
      const activity = activityByNodeId[node.id] ?? 0;
      const borderColor =
        status === "active" ? "#22c55e" : status === "completed" ? "#0ea5e9" : status === "error" ? "#ef4444" : "#9ca3af";
      return {
        id: node.id,
        type: node.type,
        position: node.position,
        data: {
          label: `${node.label} (${status})`
        },
        style: {
          border: `2px solid ${borderColor}`,
          borderRadius: 8,
          background: "#111827",
          color: "#f9fafb",
          boxShadow: status === "active" ? `0 0 ${Math.max(activity * 24, 4)}px ${borderColor}` : "none",
          minWidth: 140
        }
      };
    });
  }, [activityByNodeId, graphNodes, nodeStatusById]);

  const edges: Edge[] = useMemo(() => {
    return graphEdges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: edge.type,
      animated: edge.animated
    }));
  }, [graphEdges]);

  return (
    <div className={className} style={{ height }}>
      <ReactFlow nodes={nodes} edges={edges} fitView>
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  );
}
