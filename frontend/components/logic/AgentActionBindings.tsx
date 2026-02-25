"use client";

import { useEffect } from "react";

import { useAgentStore } from "@/store/useAgentStore";

function getPromptInputValue(): string {
  const element = document.getElementById("agent-user-prompt");
  if (!element) {
    return "";
  }
  if ("value" in element) {
    return String((element as HTMLInputElement).value ?? "");
  }
  return element.textContent ?? "";
}

export function AgentActionBindings() {
  const fetchFiles = useAgentStore((state) => state.fetchFiles);
  const fetchTree = useAgentStore((state) => state.fetchTree);
  const startAgentRun = useAgentStore((state) => state.startAgentRun);
  const downloadWorkspaceZip = useAgentStore((state) => state.downloadWorkspaceZip);
  const readFile = useAgentStore((state) => state.readFile);
  const updateFileContent = useAgentStore((state) => state.updateFileContent);

  useEffect(() => {
    void fetchFiles();
    void fetchTree();

    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) {
        return;
      }

      const actionElement = target.closest<HTMLElement>("[data-agent-action]");
      if (!actionElement) {
        return;
      }

      const action = actionElement.dataset.agentAction;
      if (!action) {
        return;
      }

      if (action === "run-agent") {
        void startAgentRun({ userPrompt: getPromptInputValue() });
        return;
      }
      if (action === "refresh-files") {
        void Promise.all([fetchFiles(), fetchTree()]);
        return;
      }
      if (action === "download-zip") {
        downloadWorkspaceZip();
        return;
      }
      if (action === "open-file") {
        const filePath = actionElement.dataset.agentFilePath;
        if (filePath) {
          void readFile(filePath);
        }
        return;
      }
      if (action === "save-file") {
        const filePath = actionElement.dataset.agentFilePath;
        const sourceId = actionElement.dataset.agentSourceId;
        if (!filePath || !sourceId) {
          return;
        }
        const sourceElement = document.getElementById(sourceId);
        if (sourceElement && "value" in sourceElement) {
          void updateFileContent(filePath, String((sourceElement as HTMLInputElement).value ?? ""));
        }
      }
    };

    document.addEventListener("click", onClick);
    return () => {
      document.removeEventListener("click", onClick);
    };
  }, [downloadWorkspaceZip, fetchFiles, fetchTree, readFile, startAgentRun, updateFileContent]);

  return null;
}
