"use client";

import { useEffect } from "react";
import Editor from "@monaco-editor/react";

import { useAgentStore } from "@/store/useAgentStore";

interface MonacoWorkspaceBridgeProps {
  height?: string;
  className?: string;
}

function languageFromPath(path: string | null): string {
  if (!path) {
    return "plaintext";
  }
  const lower = path.toLowerCase();
  if (lower.endsWith(".py")) return "python";
  if (lower.endsWith(".ts")) return "typescript";
  if (lower.endsWith(".tsx")) return "typescript";
  if (lower.endsWith(".js")) return "javascript";
  if (lower.endsWith(".jsx")) return "javascript";
  if (lower.endsWith(".json")) return "json";
  if (lower.endsWith(".md")) return "markdown";
  if (lower.endsWith(".css")) return "css";
  if (lower.endsWith(".html")) return "html";
  return "plaintext";
}

export function MonacoWorkspaceBridge({ height = "70vh", className }: MonacoWorkspaceBridgeProps) {
  const files = useAgentStore((state) => state.files);
  const activeFilePath = useAgentStore((state) => state.activeFilePath);
  const fetchFiles = useAgentStore((state) => state.fetchFiles);
  const setActiveFilePath = useAgentStore((state) => state.setActiveFilePath);
  const updateFileContent = useAgentStore((state) => state.updateFileContent);

  useEffect(() => {
    void fetchFiles();
  }, [fetchFiles]);

  const paths = Object.keys(files).sort();
  const selectedPath = activeFilePath ?? (paths.length ? paths[0] : null);

  useEffect(() => {
    if (!activeFilePath && selectedPath) {
      setActiveFilePath(selectedPath);
    }
  }, [activeFilePath, selectedPath, setActiveFilePath]);

  if (!selectedPath) {
    return <div className={className}>No workspace files yet.</div>;
  }

  return (
    <div className={className}>
      <Editor
        path={selectedPath}
        language={languageFromPath(selectedPath)}
        value={files[selectedPath] ?? ""}
        height={height}
        onChange={(value) => {
          void updateFileContent(selectedPath, value ?? "");
        }}
        options={{
          minimap: { enabled: false },
          automaticLayout: true,
          fontSize: 14
        }}
      />
    </div>
  );
}
