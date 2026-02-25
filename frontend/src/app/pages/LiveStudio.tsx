import { useState, useRef, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Play,
  Download,
  RefreshCw,
  FileCode2,
  Folder,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  Terminal,
  Activity,
  Zap,
  CheckCircle2,
  Clock,
  Loader2,
  X,
  AlertCircle,
  Key,
  Eye,
  EyeOff,
  RotateCcw,
  SlidersHorizontal,
  ShieldCheck,
  Info,
} from "lucide-react";
import type { NodeId, PromptNodeSchema, WorkspaceTreeNode } from "@/app/lib/api-client";
import { useAgentStore } from "@/app/store/useAgentStore";

// ─── Types ────────────────────────────────────────────────────────────────────

type NodeStatus = "idle" | "running" | "done" | "error";
type RightPanelTab = "graph" | "prompts";

interface FileNode {
  name: string;
  path: string;
  type: "file" | "folder";
  children?: FileNode[];
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const NODE_UI_CONFIG: Record<NodeId, { label: string; color: string; placeholder: string }> = {
  planner: {
    label: "Planner",
    color: "#a78bfa",
    placeholder: "Override the planner's mutable prompt body...",
  },
  architect: {
    label: "Architect",
    color: "#06b6d4",
    placeholder: "Override the architect's mutable prompt body...",
  },
  coder: {
    label: "Coder",
    color: "#34d399",
    placeholder: "Override the coder's mutable prompt body...",
  },
};

function toFileNodes(nodes: WorkspaceTreeNode[]): FileNode[] {
  return nodes.map((node) => ({
    name: node.name,
    path: node.path,
    type: node.type === "directory" ? "folder" : "file",
    children: node.children ? toFileNodes(node.children) : undefined,
  }));
}

function toNodeStatus(value: string | undefined): NodeStatus {
  if (value === "active") return "running";
  if (value === "completed") return "done";
  if (value === "error") return "error";
  return "idle";
}

function toSeverity(value: string | undefined): "info" | "success" | "warn" | "error" {
  if (value === "error") return "error";
  if (value === "warn") return "warn";
  if (value === "success") return "success";
  return "info";
}

function formatLogTime(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return timestamp;
  }
  return date.toLocaleTimeString([], { hour12: false });
}

function formatLogDetails(details: Record<string, unknown> | null | undefined): string | null {
  if (!details) {
    return null;
  }
  const entries = Object.entries(details).filter(([, value]) => value !== null && value !== undefined);
  if (entries.length === 0) {
    return null;
  }
  return entries
    .slice(0, 4)
    .map(([key, value]) => `${key}=${typeof value === "object" ? JSON.stringify(value) : String(value)}`)
    .join(" | ");
}

function readStoredApiKey(): string {
  return (
    localStorage.getItem("X-API-KEY") ??
    localStorage.getItem("groq_api_key") ??
    localStorage.getItem("api_key") ??
    ""
  ).trim();
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function NodeBadge({ name }: { name: string }) {
  const colors: Record<string, { bg: string; color: string }> = {
    planner:   { bg: "rgba(167,139,250,0.12)", color: "#a78bfa" },
    architect: { bg: "rgba(6,182,212,0.12)",   color: "#06b6d4" },
    coder:     { bg: "rgba(52,211,153,0.12)",   color: "#34d399" },
    system:    { bg: "rgba(226,232,240,0.08)",  color: "rgba(226,232,240,0.4)" },
  };
  const c = colors[name] || colors.system;
  return (
    <span
      style={{
        padding: "1px 7px",
        borderRadius: 4,
        fontSize: 10,
        fontFamily: "'JetBrains Mono', monospace",
        fontWeight: 600,
        background: c.bg,
        color: c.color,
        flexShrink: 0,
      }}
    >
      {name}
    </span>
  );
}

function FileTreeNode({
  node,
  depth,
  activeFile,
  onOpen,
}: {
  node: FileNode;
  depth: number;
  activeFile: string | null;
  onOpen: (path: string) => void;
}) {
  const [open, setOpen] = useState(depth === 0);

  if (node.type === "folder") {
    return (
      <div>
        <button
          onClick={() => setOpen(!open)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            padding: `5px 8px 5px ${12 + depth * 14}px`,
            width: "100%",
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "rgba(226,232,240,0.55)",
            fontSize: 12,
            borderRadius: 4,
            textAlign: "left",
          }}
        >
          {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          {open ? <FolderOpen size={13} color="#fbbf24" /> : <Folder size={13} color="#fbbf24" />}
          <span>{node.name}</span>
        </button>
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.18 }}
              style={{ overflow: "hidden" }}
            >
              {node.children?.map((child) => (
                <FileTreeNode
                  key={child.path}
                  node={child}
                  depth={depth + 1}
                  activeFile={activeFile}
                  onOpen={onOpen}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  const isActive = activeFile === node.path;
  return (
    <button
      data-agent-action="open-file"
      data-agent-file-path={node.path}
      onClick={() => onOpen(node.path)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: `5px 8px 5px ${22 + depth * 14}px`,
        width: "100%",
        background: isActive ? "rgba(124,58,237,0.15)" : "none",
        border: "none",
        cursor: "pointer",
        color: isActive ? "#a78bfa" : "rgba(226,232,240,0.55)",
        fontSize: 12,
        borderRadius: 4,
        textAlign: "left",
        transition: "all 0.15s",
        fontFamily: isActive ? "'JetBrains Mono', monospace" : "inherit",
      }}
    >
      <FileCode2 size={12} />
      <span>{node.name}</span>
    </button>
  );
}

function GraphNode({
  label,
  status,
  color,
  activityScore,
}: {
  label: string;
  status: NodeStatus;
  color: string;
  activityScore: number;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <motion.div
        animate={
          status === "running"
            ? { boxShadow: [`0 0 0px ${color}`, `0 0 18px ${color}55`, `0 0 0px ${color}`] }
            : {}
        }
        transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
        style={{
          width: 64,
          height: 64,
          borderRadius: 14,
          border: `2px solid ${status === "idle" ? "rgba(255,255,255,0.08)" : color}`,
          background: status === "idle" ? "rgba(255,255,255,0.02)" : `${color}15`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 3,
          transition: "all 0.4s ease",
        }}
      >
        {status === "running" && (
          <Loader2 size={16} color={color} style={{ animation: "spin 1s linear infinite" }} />
        )}
        {status === "done"  && <CheckCircle2 size={16} color={color} />}
        {status === "idle"  && <Clock size={16} color="rgba(226,232,240,0.2)" />}
        {status === "error" && <AlertCircle size={16} color="#f87171" />}
        <span
          style={{
            fontSize: 9,
            fontFamily: "'JetBrains Mono', monospace",
            color: status === "idle" ? "rgba(226,232,240,0.2)" : color,
            fontWeight: 600,
          }}
        >
          {status === "running" ? `${Math.round(activityScore * 100)}%` : status}
        </span>
      </motion.div>
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          color: status === "idle" ? "rgba(226,232,240,0.25)" : color,
          fontFamily: "'JetBrains Mono', monospace",
          textTransform: "uppercase",
          letterSpacing: "0.04em",
        }}
      >
        {label}
      </div>
    </div>
  );
}

// ─── API Key Modal ────────────────────────────────────────────────────────────

function ApiKeyModal({
  onClose,
  apiKey,
  onSave,
}: {
  onClose: () => void;
  apiKey: string;
  onSave: (key: string) => void;
}) {
  const [value, setValue] = useState(apiKey);
  const [showKey, setShowKey] = useState(false);

  const handleSave = () => {
    onSave(value.trim());
    onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "rgba(0,0,0,0.65)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ duration: 0.2 }}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#0f0f1a",
          border: "1px solid rgba(124,58,237,0.25)",
          borderRadius: 16,
          padding: 28,
          width: "100%",
          maxWidth: 480,
          boxShadow: "0 24px 64px rgba(0,0,0,0.5), 0 0 0 1px rgba(124,58,237,0.1)",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: "rgba(124,58,237,0.15)",
                  border: "1px solid rgba(124,58,237,0.3)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#a78bfa",
                }}
              >
                <Key size={16} />
              </div>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: "#f1f5f9", margin: 0, letterSpacing: "-0.02em" }}>
                  Groq API Key
                </h3>
                <p style={{ fontSize: 11, color: "rgba(226,232,240,0.35)", margin: 0 }}>
                  Required to run the agent
                </p>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(226,232,240,0.4)", padding: 4 }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Safety notice */}
        <div
          style={{
            padding: "12px 14px",
            borderRadius: 10,
            background: "rgba(52,211,153,0.07)",
            border: "1px solid rgba(52,211,153,0.18)",
            marginBottom: 20,
            display: "flex",
            gap: 10,
            alignItems: "flex-start",
          }}
        >
          <ShieldCheck size={15} color="#34d399" style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            <p style={{ fontSize: 12, color: "#34d399", fontWeight: 600, margin: "0 0 3px" }}>
              Your key stays in your browser
            </p>
            <p style={{ fontSize: 11, color: "rgba(52,211,153,0.7)", margin: 0, lineHeight: 1.6 }}>
              The key is stored only in <code style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10 }}>localStorage</code> on your device.
              It is never sent to any server other than Groq's API directly. We do not log, store, or transmit it.
            </p>
          </div>
        </div>

        {/* Free tier notice */}
        <div
          style={{
            padding: "12px 14px",
            borderRadius: 10,
            background: "rgba(251,191,36,0.07)",
            border: "1px solid rgba(251,191,36,0.18)",
            marginBottom: 20,
            display: "flex",
            gap: 10,
            alignItems: "flex-start",
          }}
        >
          <Info size={15} color="#fbbf24" style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            <p style={{ fontSize: 12, color: "#fbbf24", fontWeight: 600, margin: "0 0 3px" }}>
              Groq free tier has rate limits
            </p>
            <p style={{ fontSize: 11, color: "rgba(251,191,36,0.7)", margin: 0, lineHeight: 1.6 }}>
              The free plan has token-per-minute and request limits. For best results, prompt for{" "}
              <strong style={{ color: "#fbbf24" }}>small, focused projects</strong> — e.g. "a single-file FastAPI health check endpoint" rather
              than a full multi-module app. Complex prompts may exhaust the limit mid-run.
            </p>
          </div>
        </div>

        {/* Input */}
        <label style={{ display: "block", marginBottom: 6, fontSize: 12, fontWeight: 600, color: "rgba(226,232,240,0.6)" }}>
          API Key
        </label>
        <div style={{ position: "relative", marginBottom: 20 }}>
          <input
            type={showKey ? "text" : "password"}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="gsk_••••••••••••••••••••••••••••••••"
            style={{
              width: "100%",
              padding: "10px 40px 10px 12px",
              borderRadius: 8,
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "#e2e8f0",
              fontSize: 13,
              fontFamily: "'JetBrains Mono', monospace",
              outline: "none",
              boxSizing: "border-box",
            }}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
          />
          <button
            onClick={() => setShowKey(!showKey)}
            style={{
              position: "absolute",
              right: 10,
              top: "50%",
              transform: "translateY(-50%)",
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "rgba(226,232,240,0.35)",
              display: "flex",
              alignItems: "center",
              padding: 0,
            }}
          >
            {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </div>

        {/* Get key link */}
        <p style={{ fontSize: 11, color: "rgba(226,232,240,0.3)", marginBottom: 20, lineHeight: 1.6 }}>
          Don't have a key?{" "}
          <a
            href="https://console.groq.com/keys"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "#a78bfa", textDecoration: "none" }}
          >
            Get one free at console.groq.com →
          </a>
        </p>

        {/* Actions */}
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              padding: "9px 0",
              borderRadius: 7,
              fontSize: 13,
              fontWeight: 600,
              color: "rgba(226,232,240,0.5)",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            style={{
              flex: 2,
              padding: "9px 0",
              borderRadius: 7,
              fontSize: 13,
              fontWeight: 700,
              color: "#fff",
              background: "linear-gradient(135deg, #7c3aed, #6d28d9)",
              border: "none",
              cursor: "pointer",
              boxShadow: "0 0 16px rgba(124,58,237,0.3)",
            }}
          >
            Save Key
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Prompt Override Panel ─────────────────────────────────────────────────────

function PromptOverridePanel({
  promptSchema,
  immutableRules,
  maxMutableChars,
  overrides,
  onChange,
}: {
  promptSchema: Record<NodeId, PromptNodeSchema> | null;
  immutableRules: string[];
  maxMutableChars: number;
  overrides: Record<NodeId, string>;
  onChange: (node: NodeId, value: string) => void;
}) {
  const nodeKeys: NodeId[] = ["planner", "architect", "coder"];
  const rulesText = immutableRules.length
    ? immutableRules.map((rule) => `- ${rule}`).join("\n")
    : "Loading immutable rules from backend policy...";

  return (
    <div style={{ overflowY: "auto", flex: 1 }}>
      {/* Header */}
      <div style={{ padding: "14px 16px 10px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
          <SlidersHorizontal size={12} color="#a78bfa" />
          <span style={{ fontSize: 11, fontWeight: 700, color: "#a78bfa", fontFamily: "'JetBrains Mono', monospace", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            System Prompt Editor
          </span>
        </div>
        <p style={{ fontSize: 11, color: "rgba(226,232,240,0.35)", margin: 0, lineHeight: 1.6 }}>
          Immutable system rules and node prefixes are read-only. Only the mutable body is editable and sent as <code>prompt_overrides</code>.
        </p>
      </div>

      <div style={{ padding: "10px 12px 0" }}>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 10, color: "rgba(226,232,240,0.35)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Global Immutable Rules
          </div>
          <textarea
            value={rulesText}
            readOnly
            rows={Math.min(8, Math.max(3, immutableRules.length + 1))}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 8,
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(226,232,240,0.18)",
              color: "rgba(226,232,240,0.65)",
              fontSize: 10,
              fontFamily: "'JetBrains Mono', monospace",
              lineHeight: 1.6,
              resize: "vertical",
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>
      </div>

      {/* Node overrides */}
      <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: 14 }}>
        {nodeKeys.map((nodeKey) => {
          const cfg = NODE_UI_CONFIG[nodeKey];
          const schemaNode = promptSchema?.[nodeKey];
          const currentValue = overrides[nodeKey] ?? "";
          const isModified = currentValue.trim() !== "";
          const defaultMutable = schemaNode?.default_mutable ?? "";
          const immutablePrefix =
            schemaNode?.immutable_prefix ?? "Loading immutable prefix from /api/prompts...";
          const effectiveMutable = currentValue.trim() ? currentValue : defaultMutable;
          const effectivePreview = [
            "GLOBAL IMMUTABLE RULES:",
            rulesText,
            "",
            "NODE IMMUTABLE PREFIX:",
            immutablePrefix,
            "",
            "MUTABLE LAYER:",
            effectiveMutable || "[empty mutable body]",
            "",
            "RUNTIME CONTEXT:",
            "{{context_block}}",
          ].join("\n");

          return (
            <div key={nodeKey}>
              {/* Node label */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: cfg.color,
                      boxShadow: `0 0 6px ${cfg.color}88`,
                    }}
                  />
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: cfg.color,
                      fontFamily: "'JetBrains Mono', monospace",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                    }}
                  >
                    {cfg.label}
                  </span>
                  {isModified && (
                    <span
                      style={{
                        fontSize: 9,
                        padding: "1px 6px",
                        borderRadius: 100,
                        background: `${cfg.color}18`,
                        color: cfg.color,
                        fontFamily: "'JetBrains Mono', monospace",
                        fontWeight: 600,
                      }}
                    >
                      modified
                    </span>
                  )}
                </div>
                {currentValue.trim() !== "" && (
                  <button
                    onClick={() => onChange(nodeKey, "")}
                    title="Reset to default"
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: "rgba(226,232,240,0.3)",
                      display: "flex",
                      alignItems: "center",
                      gap: 3,
                      fontSize: 10,
                      padding: "2px 4px",
                      borderRadius: 4,
                    }}
                  >
                    <RotateCcw size={10} />
                    reset
                  </button>
                )}
              </div>

              <div style={{ fontSize: 10, color: "rgba(226,232,240,0.35)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Immutable Prefix (Read-only)
              </div>
              <textarea
                value={immutablePrefix}
                readOnly
                rows={4}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 8,
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(226,232,240,0.18)",
                  color: "rgba(226,232,240,0.65)",
                  fontSize: 10,
                  fontFamily: "'JetBrains Mono', monospace",
                  lineHeight: 1.6,
                  resize: "vertical",
                  outline: "none",
                  boxSizing: "border-box",
                  marginBottom: 8,
                }}
              />

              {/* Textarea */}
              <div style={{ fontSize: 10, color: "rgba(226,232,240,0.35)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Mutable Body (Editable)
              </div>
              <textarea
                value={currentValue}
                onChange={(e) => onChange(nodeKey, e.target.value)}
                rows={4}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 8,
                  background: isModified ? `${cfg.color}08` : "rgba(255,255,255,0.025)",
                  border: `1px solid ${isModified ? `${cfg.color}30` : "rgba(255,255,255,0.07)"}`,
                  color: "#c4ccd8",
                  fontSize: 11,
                  fontFamily: "'JetBrains Mono', monospace",
                  lineHeight: 1.7,
                  resize: "vertical",
                  outline: "none",
                  boxSizing: "border-box",
                  transition: "border-color 0.2s, background 0.2s",
                }}
                placeholder={defaultMutable || cfg.placeholder}
              />
              <div
                style={{
                  fontSize: 10,
                  color: currentValue.length > maxMutableChars ? "#f87171" : "rgba(226,232,240,0.2)",
                  marginTop: 3,
                  textAlign: "right",
                }}
              >
                {currentValue.length} / {maxMutableChars} chars
              </div>

              <div style={{ fontSize: 10, color: "rgba(226,232,240,0.35)", marginTop: 8, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Effective Prompt Preview
              </div>
              <textarea
                value={effectivePreview}
                readOnly
                rows={6}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 8,
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  color: "rgba(226,232,240,0.55)",
                  fontSize: 10,
                  fontFamily: "'JetBrains Mono', monospace",
                  lineHeight: 1.6,
                  resize: "vertical",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>
          );
        })}

        {/* Info note */}
        <div
          style={{
            padding: "10px 12px",
            borderRadius: 8,
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <p style={{ fontSize: 10, color: "rgba(226,232,240,0.3)", margin: 0, lineHeight: 1.7 }}>
            Overrides apply to the next run. Sent via{" "}
            <code style={{ fontFamily: "'JetBrains Mono', monospace", color: "#a78bfa" }}>prompt_overrides</code>{" "}
            in the request body. Max {maxMutableChars} characters per node. Immutable rules and prefix cannot be modified.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Main Studio Component ────────────────────────────────────────────────────

export function LiveStudio() {
  const [prompt, setPrompt] = useState("Build a minimal FastAPI health check endpoint with one GET route.");
  const [rightTab, setRightTab] = useState<RightPanelTab>("graph");
  const [showApiModal, setShowApiModal] = useState(false);
  const [apiKey, setApiKey] = useState(() => readStoredApiKey());
  const [editorContent, setEditorContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const logsEndRef = useRef<HTMLDivElement>(null);
  const workspaceId = useAgentStore((state) => state.workspaceId);
  const workspaceExpiresAt = useAgentStore((state) => state.workspaceExpiresAt);
  const files = useAgentStore((state) => state.files);
  const skippedBinary = useAgentStore((state) => state.skippedBinary);
  const treeNodes = useAgentStore((state) => state.treeNodes);
  const activeFile = useAgentStore((state) => state.activeFilePath);
  const activeNodeId = useAgentStore((state) => state.activeNodeId);
  const logs = useAgentStore((state) => state.logs);
  const isRunning = useAgentStore((state) => state.isGenerating);
  const promptOverrides = useAgentStore((state) => state.promptOverrides);
  const nodeStatusById = useAgentStore((state) => state.nodeStatusById);
  const activityByNodeId = useAgentStore((state) => state.activityByNodeId);
  const promptSchema = useAgentStore((state) => state.promptSchema);
  const maxMutablePromptChars = useAgentStore((state) => state.maxMutablePromptChars);
  const immutableRules = useAgentStore((state) => state.immutableRules);
  const errorMessage = useAgentStore((state) => state.errorMessage);

  const initWorkspaceSession = useAgentStore((state) => state.initWorkspaceSession);
  const resetWorkspaceSession = useAgentStore((state) => state.resetWorkspaceSession);
  const fetchFiles = useAgentStore((state) => state.fetchFiles);
  const fetchTree = useAgentStore((state) => state.fetchTree);
  const fetchGraphSchema = useAgentStore((state) => state.fetchGraphSchema);
  const fetchPromptSchema = useAgentStore((state) => state.fetchPromptSchema);
  const readFile = useAgentStore((state) => state.readFile);
  const updateFileContent = useAgentStore((state) => state.updateFileContent);
  const startAgentRun = useAgentStore((state) => state.startAgentRun);
  const downloadWorkspaceZip = useAgentStore((state) => state.downloadWorkspaceZip);
  const setActiveFilePath = useAgentStore((state) => state.setActiveFilePath);
  const setPromptOverride = useAgentStore((state) => state.setPromptOverride);

  useEffect(() => {
    void (async () => {
      await initWorkspaceSession();
      await Promise.all([fetchFiles(), fetchTree(), fetchGraphSchema(), fetchPromptSchema()]);
    })();
  }, [fetchFiles, fetchGraphSchema, fetchPromptSchema, fetchTree, initWorkspaceSession]);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  useEffect(() => {
    if (!activeFile) {
      setEditorContent("");
      return;
    }
    setEditorContent(files[activeFile] ?? "");
  }, [activeFile, files]);

  const handleSaveKey = (key: string) => {
    const trimmed = key.trim();
    setApiKey(trimmed);
    if (trimmed) {
      localStorage.setItem("X-API-KEY", trimmed);
      localStorage.setItem("groq_api_key", trimmed);
    } else {
      localStorage.removeItem("X-API-KEY");
      localStorage.removeItem("groq_api_key");
      localStorage.removeItem("api_key");
    }
  };

  const handleOverrideChange = (node: NodeId, value: string) => {
    setPromptOverride(node, value.slice(0, maxMutablePromptChars));
  };

  const handleRun = () => {
    if (!prompt.trim() || isRunning) return;
    if (!readStoredApiKey()) {
      setShowApiModal(true);
      return;
    }
    void startAgentRun({ userPrompt: prompt });
  };

  const handleRefresh = () => {
    void Promise.all([fetchFiles(), fetchTree()]);
  };

  const handleOpenFile = (path: string) => {
    void readFile(path);
  };

  const handleSaveFile = () => {
    if (!activeFile) return;
    setIsSaving(true);
    void updateFileContent(activeFile, editorContent).finally(() => setIsSaving(false));
  };

  const handleDownload = () => {
    void downloadWorkspaceZip();
  };

  const handleResetWorkspace = () => {
    void resetWorkspaceSession().then(() => Promise.all([fetchFiles(), fetchTree()]));
  };

  const sevColor: Record<string, string> = {
    info:    "rgba(226,232,240,0.5)",
    success: "#34d399",
    warn:    "#fbbf24",
    error:   "#f87171",
  };

  const fileNodes = useMemo(() => toFileNodes(treeNodes), [treeNodes]);
  const hasRun = logs.some((log) => log.event === "run_complete");
  const fileCount = Object.keys(files).length;
  const isDirty = activeFile ? editorContent !== (files[activeFile] ?? "") : false;
  const nodeStatuses = {
    planner: toNodeStatus(nodeStatusById.planner),
    architect: toNodeStatus(nodeStatusById.architect),
    coder: toNodeStatus(nodeStatusById.coder),
  };
  const activityScores = {
    planner: activityByNodeId.planner ?? 0,
    architect: activityByNodeId.architect ?? 0,
    coder: activityByNodeId.coder ?? 0,
  };
  const keyIsSet = apiKey.length > 0;
  const activeIteration = useMemo(() => {
    if (!activeNodeId) {
      return null;
    }
    for (let index = logs.length - 1; index >= 0; index -= 1) {
      const log = logs[index];
      if (log.node === activeNodeId && typeof log.iteration === "number") {
        return log.iteration;
      }
    }
    return null;
  }, [activeNodeId, logs]);

  return (
    <div style={{ height: "calc(100vh - 64px)", display: "flex", flexDirection: "column", overflow: "hidden", fontFamily: "'JetBrains Mono', monospace" }}>

      {/* ── Toolbar ───────────────────────────────────────────────── */}
      <div
        style={{
          padding: "8px 12px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
          background: "rgba(255,255,255,0.01)",
          flexShrink: 0,
        }}
      >
        {/* Logo tag */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0, marginRight: 4 }}>
          <div style={{ width: 26, height: 26, borderRadius: 7, background: "linear-gradient(135deg,#7c3aed,#06b6d4)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Zap size={12} color="white" fill="white" />
          </div>
          <span style={{ fontSize: 11, fontWeight: 700, color: "rgba(226,232,240,0.6)" }}>Live Studio</span>
        </div>

        {/* Prompt input */}
        <textarea
          id="agent-user-prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={1}
          placeholder="Describe what to build (keep it simple for free Groq tier)..."
          style={{
            flex: 1,
            minWidth: 200,
            padding: "7px 12px",
            borderRadius: 6,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.09)",
            color: "#e2e8f0",
            fontSize: 12,
            fontFamily: "'JetBrains Mono', monospace",
            resize: "none",
            outline: "none",
            lineHeight: 1.5,
          }}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleRun(); } }}
        />

        {/* Run button */}
        <button
          id="agent-run-button"
          data-agent-action="run-agent"
          onClick={handleRun}
          disabled={isRunning || !prompt.trim()}
          style={{
            display: "flex", alignItems: "center", gap: 5,
            padding: "7px 14px", borderRadius: 6, fontSize: 12, fontWeight: 700,
            color: isRunning ? "rgba(255,255,255,0.45)" : "#fff",
            background: isRunning ? "rgba(124,58,237,0.25)" : "linear-gradient(135deg,#7c3aed,#6d28d9)",
            border: "none", cursor: isRunning ? "not-allowed" : "pointer",
            boxShadow: isRunning ? "none" : "0 0 14px rgba(124,58,237,0.3)",
            transition: "all 0.2s", flexShrink: 0,
          }}
        >
          {isRunning
            ? <><Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> Running...</>
            : <><Play size={12} fill="white" /> Run</>}
        </button>

        {/* Download */}
        <button
          id="agent-download-button"
          data-agent-action="download-zip"
          onClick={handleDownload}
          disabled={fileCount === 0}
          title="Download workspace as ZIP"
          style={{
            display: "flex", alignItems: "center", gap: 4,
            padding: "7px 12px", borderRadius: 6, fontSize: 12, fontWeight: 600,
            color: fileCount > 0 ? "rgba(226,232,240,0.65)" : "rgba(226,232,240,0.2)",
            background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
            cursor: fileCount > 0 ? "pointer" : "not-allowed", flexShrink: 0,
          }}
        >
          <Download size={12} />
          <span className="hidden sm:inline">ZIP</span>
        </button>

        {/* API Key button */}
        <button
          onClick={() => setShowApiModal(true)}
          title="Set Groq API Key"
          style={{
            display: "flex", alignItems: "center", gap: 5,
            padding: "7px 12px", borderRadius: 6, fontSize: 12, fontWeight: 600,
            color: keyIsSet ? "#34d399" : "#fbbf24",
            background: keyIsSet ? "rgba(52,211,153,0.08)" : "rgba(251,191,36,0.08)",
            border: `1px solid ${keyIsSet ? "rgba(52,211,153,0.25)" : "rgba(251,191,36,0.25)"}`,
            cursor: "pointer", flexShrink: 0,
            transition: "all 0.2s",
          }}
        >
          <Key size={12} />
          <span className="hidden sm:inline">{keyIsSet ? "Key set" : "Add key"}</span>
        </button>

        <button
          onClick={handleResetWorkspace}
          title="Reset ephemeral workspace session"
          style={{
            display: "flex", alignItems: "center", gap: 5,
            padding: "7px 12px", borderRadius: 6, fontSize: 12, fontWeight: 600,
            color: "rgba(248,113,113,0.85)",
            background: "rgba(248,113,113,0.08)",
            border: "1px solid rgba(248,113,113,0.25)",
            cursor: "pointer", flexShrink: 0,
            transition: "all 0.2s",
          }}
        >
          <RotateCcw size={12} />
          <span className="hidden sm:inline">Reset Session</span>
        </button>

        <div
          style={{
            marginLeft: "auto",
            fontSize: 10,
            color: "rgba(226,232,240,0.35)",
            fontFamily: "'JetBrains Mono', monospace",
            textAlign: "right",
            lineHeight: 1.4,
          }}
        >
          <div>workspace: {workspaceId ?? "initializing..."}</div>
          {workspaceExpiresAt && <div>expires: {new Date(workspaceExpiresAt).toLocaleTimeString()}</div>}
        </div>
      </div>

      {/* ── Main panels ───────────────────────────────────────────── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0 }}>

        {/* File Tree */}
        <div
          id="agent-file-tree"
          className="hidden md:block"
          style={{ width: 190, flexShrink: 0, borderRight: "1px solid rgba(255,255,255,0.06)", overflowY: "auto", padding: "8px 4px" }}
        >
          <div style={{ padding: "4px 12px 8px", fontSize: 10, color: "rgba(226,232,240,0.25)", textTransform: "uppercase", letterSpacing: "0.08em", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span>Files</span>
            <RefreshCw size={10} style={{ cursor: "pointer" }} data-agent-action="refresh-files" onClick={handleRefresh} />
          </div>
          {fileNodes.length === 0 && (
            <div style={{ padding: "10px 12px", fontSize: 11, color: "rgba(226,232,240,0.25)" }}>
              No files yet. Run the agent to generate a project.
            </div>
          )}
          {fileNodes.map((f) => (
            <FileTreeNode key={f.path} node={f} depth={0} activeFile={activeFile} onOpen={handleOpenFile} />
          ))}
          {skippedBinary.length > 0 && (
            <div style={{ marginTop: 8, padding: "0 12px", fontSize: 10, color: "rgba(251,191,36,0.7)" }}>
              {skippedBinary.length} binary file(s) skipped.
            </div>
          )}
        </div>

        {/* Editor */}
        <div
          id="agent-editor"
          style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", borderRight: "1px solid rgba(255,255,255,0.06)" }}
        >
          {/* Tab bar */}
          <div style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", flexShrink: 0, overflowX: "auto", background: "rgba(255,255,255,0.01)" }}>
            {activeFile && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", fontSize: 12, color: "#a78bfa", borderBottom: "2px solid #7c3aed", background: "rgba(124,58,237,0.07)", cursor: "pointer", flexShrink: 0 }}>
                <FileCode2 size={11} />
                <span>{activeFile.split("/").pop()}</span>
                <X size={10} style={{ opacity: 0.45, cursor: "pointer" }} onClick={() => setActiveFilePath(null)} />
              </div>
            )}
            {activeFile && (
              <button
                data-agent-action="save-file"
                data-agent-file-path={activeFile}
                data-agent-source-id="agent-editor-input"
                onClick={handleSaveFile}
                disabled={!isDirty || isSaving}
                style={{
                  marginLeft: "auto",
                  marginRight: 12,
                  padding: "6px 10px",
                  borderRadius: 6,
                  border: "1px solid rgba(52,211,153,0.3)",
                  background: "rgba(52,211,153,0.1)",
                  color: isDirty ? "#34d399" : "rgba(52,211,153,0.45)",
                  fontSize: 11,
                  cursor: isDirty ? "pointer" : "not-allowed",
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                {isSaving ? "Saving..." : isDirty ? "Save" : "Saved"}
              </button>
            )}
          </div>
          {/* Code content */}
          <div style={{ flex: 1, overflowY: "auto", padding: "18px 22px", background: "#0a0a14" }}>
            {activeFile ? (
              <textarea
                id="agent-editor-input"
                value={editorContent}
                onChange={(e) => setEditorContent(e.target.value)}
                style={{
                  width: "100%",
                  minHeight: "100%",
                  margin: 0,
                  fontSize: 12,
                  lineHeight: 1.85,
                  color: "#c4ccd8",
                  fontFamily: "'JetBrains Mono', monospace",
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  resize: "none",
                  boxSizing: "border-box",
                }}
                onKeyDown={(e) => {
                  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
                    e.preventDefault();
                    handleSaveFile();
                  }
                }}
              />
            ) : (
              <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(226,232,240,0.12)", flexDirection: "column", gap: 8 }}>
                <FileCode2 size={28} />
                <span style={{ fontSize: 12 }}>Select a file to view and edit</span>
              </div>
            )}
          </div>
        </div>

        {/* Right panel */}
        <div style={{ width: 288, display: "flex", flexDirection: "column", flexShrink: 0 }}>

          {/* Tab switcher */}
          <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }}>
            {([["graph", <Activity size={11} />, "Graph & Logs"] as const, ["prompts", <SlidersHorizontal size={11} />, "System Prompt"] as const]).map(([tab, icon, label]) => (
              <button
                key={tab}
                onClick={() => setRightTab(tab)}
                style={{
                  flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                  padding: "9px 0", fontSize: 11, fontWeight: 600,
                  color: rightTab === tab ? "#a78bfa" : "rgba(226,232,240,0.35)",
                  background: rightTab === tab ? "rgba(139,92,246,0.07)" : "transparent",
                  borderBottom: rightTab === tab ? "2px solid #7c3aed" : "2px solid transparent",
                  border: "none", cursor: "pointer",
                  fontFamily: "'JetBrains Mono', monospace",
                  transition: "all 0.15s",
                }}
              >
                {icon} {label}
              </button>
            ))}
          </div>

          {/* Graph + Logs tab */}
          <AnimatePresence mode="wait">
            {rightTab === "graph" && (
              <motion.div
                key="graph"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}
              >
                {/* Graph viz */}
                <div id="agent-graph" style={{ padding: "14px", borderBottom: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }}>
                  <div style={{ fontSize: 10, color: "rgba(226,232,240,0.22)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 14, display: "flex", alignItems: "center", gap: 5 }}>
                    <Activity size={9} /> Agent Graph
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2 }}>
                    <GraphNode label="Planner"   status={nodeStatuses.planner}   color="#a78bfa" activityScore={activityScores.planner} />
                    <div style={{ flex: 1, height: 2, background: nodeStatuses.planner   === "done" ? "linear-gradient(90deg,#a78bfa,#06b6d4)" : "rgba(255,255,255,0.06)", borderRadius: 1, transition: "background 0.5s" }} />
                    <GraphNode label="Architect" status={nodeStatuses.architect} color="#06b6d4" activityScore={activityScores.architect} />
                    <div style={{ flex: 1, height: 2, background: nodeStatuses.architect === "done" ? "linear-gradient(90deg,#06b6d4,#34d399)" : "rgba(255,255,255,0.06)", borderRadius: 1, transition: "background 0.5s" }} />
                    <GraphNode label="Coder"     status={nodeStatuses.coder}     color="#34d399" activityScore={activityScores.coder} />
                  </div>
                  <AnimatePresence>
                    {hasRun && (
                      <motion.div
                        initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        style={{ marginTop: 12, padding: "7px 12px", borderRadius: 6, background: "rgba(52,211,153,0.07)", border: "1px solid rgba(52,211,153,0.18)", fontSize: 11, color: "#34d399", textAlign: "center" }}
                      >
                        Complete - {fileCount} text file(s) in workspace
                      </motion.div>
                    )}
                  </AnimatePresence>
                  {activeNodeId && (
                    <div style={{ marginTop: 8, fontSize: 10, color: "rgba(226,232,240,0.45)", textAlign: "center" }}>
                      Active node: {activeNodeId}{typeof activeIteration === "number" ? ` (iteration ${activeIteration})` : ""}
                    </div>
                  )}
                </div>

                {/* Logs */}
                <div id="agent-logs" style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
                  <div style={{ padding: "10px 14px", borderBottom: "1px solid rgba(255,255,255,0.06)", fontSize: 10, color: "rgba(226,232,240,0.22)", textTransform: "uppercase", letterSpacing: "0.08em", display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
                    <Terminal size={9} />
                    Stream Logs
                    {isRunning && (
                      <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 4, color: "#a78bfa" }}>
                        <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#a78bfa", animation: "pulse 1s infinite" }} />
                        LIVE
                      </span>
                    )}
                  </div>
                  <div style={{ flex: 1, overflowY: "auto", padding: "6px 8px" }}>
                    {logs.length === 0 && (
                      <div style={{ padding: "20px", textAlign: "center", fontSize: 11, color: "rgba(226,232,240,0.15)" }}>
                        Run the agent to see live logs
                      </div>
                    )}
                    {logs.map((log) => {
                      const severity = toSeverity(log.severity);
                      const detailText = formatLogDetails(log.details);
                      const metaParts = [
                        typeof log.iteration === "number" ? `iteration=${log.iteration}` : null,
                        typeof log.duration_ms === "number" ? `duration=${log.duration_ms}ms` : null,
                        log.error_type ? `type=${log.error_type}` : null,
                      ].filter(Boolean) as string[];
                      return (
                        <motion.div
                          key={log.id}
                          initial={{ opacity: 0, x: 4 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.18 }}
                          style={{
                            padding: "6px 7px",
                            borderRadius: 6,
                            marginBottom: 4,
                            border:
                              severity === "error"
                                ? "1px solid rgba(248,113,113,0.2)"
                                : "1px solid rgba(255,255,255,0.04)",
                            background:
                              severity === "error"
                                ? "rgba(248,113,113,0.06)"
                                : "rgba(255,255,255,0.015)",
                          }}
                        >
                          <div style={{ display: "flex", gap: 5, alignItems: "flex-start" }}>
                            <span style={{ fontSize: 9, color: "rgba(226,232,240,0.18)", flexShrink: 0, paddingTop: 2 }}>{formatLogTime(log.timestamp)}</span>
                            <NodeBadge name={log.node ?? "system"} />
                            <span style={{ fontSize: 11, color: sevColor[severity], lineHeight: 1.5, flex: 1 }}>{log.message}</span>
                          </div>
                          {(metaParts.length > 0 || detailText || log.hint) && (
                            <div style={{ marginTop: 4, marginLeft: 60 }}>
                              {metaParts.length > 0 && (
                                <div style={{ fontSize: 10, color: "rgba(226,232,240,0.38)", lineHeight: 1.5 }}>
                                  {metaParts.join(" | ")}
                                </div>
                              )}
                              {detailText && (
                                <div style={{ fontSize: 10, color: "rgba(226,232,240,0.3)", lineHeight: 1.5 }}>
                                  {detailText}
                                </div>
                              )}
                              {log.hint && (
                                <div style={{ fontSize: 10, color: "#fbbf24", lineHeight: 1.5 }}>
                                  hint: {log.hint}
                                </div>
                              )}
                            </div>
                          )}
                        </motion.div>
                      );
                    })}
                    {errorMessage && (
                      <div style={{ margin: "8px 4px", padding: "8px 10px", borderRadius: 6, border: "1px solid rgba(248,113,113,0.35)", background: "rgba(248,113,113,0.1)", color: "#f87171", fontSize: 11 }}>
                        {errorMessage}
                      </div>
                    )}
                    <div ref={logsEndRef} />
                  </div>
                </div>
              </motion.div>
            )}

            {/* Prompts tab */}
            {rightTab === "prompts" && (
              <motion.div
                key="prompts"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}
              >
                <PromptOverridePanel
                  promptSchema={promptSchema?.nodes ?? null}
                  immutableRules={immutableRules}
                  maxMutableChars={maxMutablePromptChars}
                  overrides={promptOverrides}
                  onChange={handleOverrideChange}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* API Key modal */}
      <AnimatePresence>
        {showApiModal && (
          <ApiKeyModal
            onClose={() => setShowApiModal(false)}
            apiKey={apiKey}
            onSave={handleSaveKey}
          />
        )}
      </AnimatePresence>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
      `}</style>
    </div>
  );
}


