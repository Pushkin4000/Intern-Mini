"use client";

import { AgentActionBindings } from "@/components/logic/AgentActionBindings";
import { AgentGraphBridge } from "@/components/logic/AgentGraphBridge";
import { MonacoWorkspaceBridge } from "@/components/logic/MonacoWorkspaceBridge";

export default function HomePage() {
  return (
    <main>
      <AgentActionBindings />
      <div id="agent-file-tree" />
      <div id="agent-editor">
        <MonacoWorkspaceBridge />
      </div>
      <div id="agent-graph">
        <AgentGraphBridge />
      </div>
      <div id="agent-logs" />
      <button id="agent-run-button" data-agent-action="run-agent" type="button">
        Run Agent
      </button>
      <button id="agent-download-button" data-agent-action="download-zip" type="button">
        Download ZIP
      </button>
    </main>
  );
}
