import { useState } from "react";
import { motion } from "motion/react";
import {
  ChevronRight,
  Terminal,
  GitBranch,
  FileCode2,
  Layers,
  Database,
  Zap,
  Copy,
  Check,
  Key,
  ShieldCheck,
  AlertTriangle,
  Lightbulb,
} from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] },
  }),
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  return (
    <button
      onClick={copy}
      style={{ background: "none", border: "none", cursor: "pointer", color: copied ? "#34d399" : "rgba(226,232,240,0.3)", padding: 4, display: "flex", alignItems: "center", transition: "color 0.2s" }}
    >
      {copied ? <Check size={13} /> : <Copy size={13} />}
    </button>
  );
}

function CodeBlock({ code, lang = "python" }: { code: string; lang?: string }) {
  return (
    <div style={{ borderRadius: 10, border: "1px solid rgba(255,255,255,0.07)", background: "#0a0a14", overflow: "hidden", fontFamily: "'JetBrains Mono', monospace", fontSize: 12, marginTop: 12, marginBottom: 4 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 14px", background: "rgba(255,255,255,0.03)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <span style={{ color: "rgba(226,232,240,0.25)", fontSize: 11 }}>{lang}</span>
        <CopyButton text={code} />
      </div>
      <pre style={{ margin: 0, padding: "16px 18px", color: "#c4ccd8", lineHeight: 1.7, overflowX: "auto", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
        {code}
      </pre>
    </div>
  );
}

function Badge({ method }: { method: string }) {
  const colors: Record<string, { bg: string; color: string }> = {
    GET:    { bg: "rgba(52,211,153,0.12)",  color: "#34d399" },
    POST:   { bg: "rgba(124,58,237,0.12)",  color: "#a78bfa" },
    PUT:    { bg: "rgba(251,191,36,0.12)",  color: "#fbbf24" },
    DELETE: { bg: "rgba(239,68,68,0.12)",   color: "#f87171" },
  };
  const c = colors[method] || { bg: "rgba(226,232,240,0.1)", color: "#94a3b8" };
  return (
    <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.05em", background: c.bg, color: c.color }}>
      {method}
    </span>
  );
}

function EndpointRow({ method, path, desc }: { method: string; path: string; desc: string }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "14px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
      <Badge method={method} />
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: "#e2e8f0", marginBottom: 2 }}>{path}</div>
        <div style={{ fontSize: 12, color: "rgba(226,232,240,0.45)" }}>{desc}</div>
      </div>
    </div>
  );
}

function SectionHeading({ title }: { title: string }) {
  return (
    <h2 style={{ fontSize: 22, fontWeight: 700, color: "#f1f5f9", letterSpacing: "-0.02em", marginBottom: 8, borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 32 }}>
      {title}
    </h2>
  );
}

const sections = [
  { id: "overview",      label: "Overview",          icon: <Layers size={14} /> },
  { id: "groq",          label: "Groq API Key",       icon: <Key size={14} /> },
  { id: "architecture",  label: "Architecture",       icon: <GitBranch size={14} /> },
  { id: "api",           label: "API Reference",      icon: <Terminal size={14} /> },
  { id: "prompts",       label: "Prompt Schema",      icon: <FileCode2 size={14} /> },
  { id: "workspace",     label: "Workspace",          icon: <Database size={14} /> },
  { id: "stitching",     label: "Stitching Contract", icon: <Zap size={14} /> },
];

export function Docs() {
  const [active, setActive] = useState("overview");

  const scrollTo = (id: string) => {
    setActive(id);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div style={{ display: "flex", maxWidth: 1200, margin: "0 auto", padding: "40px 24px", gap: 40, minHeight: "calc(100vh - 64px)" }}>

      {/* Sidebar */}
      <aside className="hidden lg:block" style={{ width: 220, flexShrink: 0, position: "sticky", top: 88, height: "fit-content" }}>
        <p style={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace", color: "rgba(226,232,240,0.3)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>
          Documentation
        </p>
        {sections.map((s) => (
          <button
            key={s.id}
            onClick={() => scrollTo(s.id)}
            style={{
              display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "8px 12px", borderRadius: 6,
              fontSize: 13, fontWeight: active === s.id ? 600 : 400,
              color: active === s.id ? "#a78bfa" : "rgba(226,232,240,0.5)",
              background: active === s.id ? "rgba(139,92,246,0.1)" : "transparent",
              border: "none", cursor: "pointer", textAlign: "left", transition: "all 0.2s", marginBottom: 2,
            }}
          >
            {s.icon}
            {s.label}
            {active === s.id && <ChevronRight size={12} style={{ marginLeft: "auto" }} />}
          </button>
        ))}
      </aside>

      {/* Content */}
      <div style={{ flex: 1, maxWidth: 780 }}>

        <motion.section id="overview" variants={fadeUp} custom={0} initial="hidden" animate="visible" style={{ marginBottom: 64 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 10px", borderRadius: 100, fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: "#a78bfa", background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.2)", marginBottom: 16 }}>
            <Layers size={11} /> Overview
          </div>
          <h1 style={{ fontSize: 32, fontWeight: 700, color: "#f1f5f9", letterSpacing: "-0.03em", marginBottom: 16 }}>
            Charito Docs
          </h1>
          <p style={{ fontSize: 14, color: "rgba(226,232,240,0.55)", lineHeight: 1.8, marginBottom: 16 }}>
            Charito, an Agentic Coding Platform, combines a FastAPI backend and a Vite React
            frontend to run a three-node LangGraph workflow: planner -&gt; architect
            -&gt; coder. The coder node loops through architect-produced
            implementation steps until status is DONE.
          </p>
          <p style={{ fontSize: 14, color: "rgba(226,232,240,0.55)", lineHeight: 1.8 }}>
            Prompt composition, graph orchestration, stream normalization, and workspace
            APIs are all inspectable in code. In Charito, Live
            Studio consumes the SSE event stream to render node state, filtered logs,
            and generated files in real time.
          </p>
        </motion.section>

        <motion.section id="groq" variants={fadeUp} custom={0} initial="hidden" whileInView="visible" viewport={{ once: true }} style={{ marginBottom: 64 }}>
          <SectionHeading title="Groq API Key" />
          <p style={{ fontSize: 14, color: "rgba(226,232,240,0.5)", marginBottom: 20, lineHeight: 1.8 }}>
            The backend provider is <strong style={{ color: "#e2e8f0" }}>Groq</strong> via
            <code style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: "#06b6d4" }}> langchain-groq</code>.
            You must provide a key for `/generate` or `/stream` requests, either in the
            <code style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: "#06b6d4" }}> X-API-KEY</code> header or
            the request body `api_key` field.
          </p>

          <div style={{ padding: "18px 20px", borderRadius: 12, background: "rgba(52,211,153,0.06)", border: "1px solid rgba(52,211,153,0.2)", marginBottom: 12, display: "flex", gap: 14, alignItems: "flex-start" }}>
            <ShieldCheck size={20} color="#34d399" style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <p style={{ fontSize: 14, fontWeight: 700, color: "#34d399", margin: "0 0 6px" }}>
                Key handling in Charito
              </p>
              <p style={{ fontSize: 13, color: "rgba(52,211,153,0.75)", margin: 0, lineHeight: 1.7 }}>
                In Live Studio, the key is stored in browser `sessionStorage` by default.
                Requests send it to the backend, where it is used to instantiate the chat model for that run.
                The workspace/session services DO NOT PERSIST API keys.
              </p>
            </div>
          </div>

          <div style={{ padding: "18px 20px", borderRadius: 12, background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.2)", marginBottom: 12, display: "flex", gap: 14, alignItems: "flex-start" }}>
            <AlertTriangle size={20} color="#fbbf24" style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <p style={{ fontSize: 14, fontWeight: 700, color: "#fbbf24", margin: "0 0 6px" }}>
                Rate limits still apply
              </p>
              <p style={{ fontSize: 13, color: "rgba(251,191,36,0.75)", margin: "0 0 8px", lineHeight: 1.7 }}>
                Complex prompts can exceed free-tier token quotas. The workflow performs
                multiple model calls and may stream large outputs during generation.
              </p>
              <p style={{ fontSize: 13, color: "rgba(251,191,36,0.75)", margin: 0, lineHeight: 1.7 }}>
                If you receive rate limit errors, retry after cooldown with a smaller, simpler and
                more focused prompt.
              </p>
            </div>
          </div>

          <div style={{ padding: "18px 20px", borderRadius: 12, background: "rgba(167,139,250,0.06)", border: "1px solid rgba(167,139,250,0.2)", marginBottom: 20, display: "flex", gap: 14, alignItems: "flex-start" }}>
            <Lightbulb size={20} color="#a78bfa" style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ width: "100%" }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: "#a78bfa", margin: "0 0 10px" }}>
                Prompt sizing guidance
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {[
                  { good: true,  text: '"Build a minimal FastAPI health endpoint."' },
                  { good: true,  text: '"Create a static to-do list app with local storage."' },
                  { good: true,  text: '"Generate a password strength checker CLI."' },
                  { good: false, text: '"Build a complete SaaS platform with billing, auth, and admin dashboards."' },
                  { good: false, text: '"Generate a full-stack enterprise app with analytics, CI/CD, and tests."' },
                ].map((tip, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                    <span style={{ color: tip.good ? "#34d399" : "#f87171", fontSize: 14, flexShrink: 0 }}>
                      {tip.good ? "OK" : "NO"}
                    </span>
                    <code style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: tip.good ? "rgba(52,211,153,0.85)" : "rgba(248,113,113,0.75)", lineHeight: 1.6 }}>
                      {tip.text}
                    </code>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <CodeBlock
            lang="bash"
            code={`# Get a key at https://console.groq.com/keys

curl -X POST http://localhost:8000/generate \\
  -H "X-API-KEY: gsk_your_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{"user_prompt": "A minimal FastAPI health endpoint"}'`}
          />
        </motion.section>

        <motion.section id="architecture" variants={fadeUp} custom={1} initial="hidden" whileInView="visible" viewport={{ once: true }} style={{ marginBottom: 64 }}>
          <SectionHeading title="Architecture" />
          <p style={{ fontSize: 14, color: "rgba(226,232,240,0.5)", marginBottom: 20, lineHeight: 1.8 }}>
            Python FastAPI backend and Vite React frontend connected via REST and SSE.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[
              { file: "agent/graph.py", desc: "Builds the LangGraph nodes/edges and executes planner -&gt; architect -&gt; coder." },
              { file: "agent/state.py", desc: "Pydantic and typed state models for plans, task steps, and coder progress." },
              { file: "agent/prompts.py", desc: "Prompt composition helpers: immutable rules/prefix plus mutable layer resolution." },
              { file: "config/prompts.py", desc: "Node prompt config and max mutable prompt policy constants." },
              { file: "agent/api.py", desc: "FastAPI routes for run/stream, schema retrieval, and workspace management." },
              { file: "agent/workspace.py", desc: "Session-scoped workspace service with safe path resolution and zip export." },
              { file: "agent/tools.py", desc: "Coder tool wrappers: read_file, write_file, and list_files." },
              { file: "agent/llm_factory.py", desc: "Provider/model factory for ChatGroq initialization." },
              { file: "frontend/src/app/lib/api-client.ts", desc: "Typed frontend client for schema, workflow, and workspace endpoints." },
              { file: "frontend/src/app/store/useAgentStore.ts", desc: "Run lifecycle state, graph status updates, prompt overrides, and log filtering." },
            ].map((f) => (
              <div key={f.file} style={{ display: "flex", alignItems: "flex-start", gap: 14, padding: "12px 16px", borderRadius: 8, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <code style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#06b6d4", flexShrink: 0, minWidth: 200 }}>
                  {f.file}
                </code>
                <span style={{ fontSize: 13, color: "rgba(226,232,240,0.5)" }}>{f.desc}</span>
              </div>
            ))}
          </div>
        </motion.section>

        <motion.section id="api" variants={fadeUp} custom={0} initial="hidden" whileInView="visible" viewport={{ once: true }} style={{ marginBottom: 64 }}>
          <SectionHeading title="API Reference" />
          <p style={{ fontSize: 14, color: "rgba(226,232,240,0.5)", marginBottom: 20, lineHeight: 1.8 }}>
            Endpoints are defined in <code style={{ fontFamily: "'JetBrains Mono', monospace", color: "#06b6d4", fontSize: 13 }}>agent/api.py</code>.
            API key may be supplied by <code style={{ fontFamily: "'JetBrains Mono', monospace", color: "#06b6d4", fontSize: 13 }}>X-API-KEY</code>
            header or request-body <code style={{ fontFamily: "'JetBrains Mono', monospace", color: "#06b6d4", fontSize: 13 }}>api_key</code>.
          </p>

          <div style={{ marginBottom: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: "#e2e8f0", marginBottom: 2 }}>Health and Schema</h3>
            <EndpointRow method="GET" path="/health" desc="Returns provider/model defaults plus mutable prompt and editable file limits." />
            <EndpointRow method="GET" path="/v1/prompt-policy" desc="Returns immutable prompt policy rules and max mutable chars." />
            <EndpointRow method="GET" path="/api/prompts" desc="Returns node prompt schema for planner, architect, and coder." />
            <EndpointRow method="GET" path="/prompts/schema" desc="Alias for prompt schema endpoint." />
            <EndpointRow method="GET" path="/v1/prompts/schema" desc="Versioned prompt schema alias." />
            <EndpointRow method="GET" path="/graph/schema" desc="Returns graph nodes/edges and UI state/activity model metadata." />
          </div>

          <div style={{ marginBottom: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: "#e2e8f0", marginBottom: 2 }}>Workflow</h3>
            <EndpointRow method="POST" path="/generate" desc="Synchronous run. Returns status, provider, workspace_id, plan, and task_plan." />
            <EndpointRow method="POST" path="/v1/workflows/run" desc="Versioned alias for /generate." />
            <EndpointRow method="POST" path="/stream" desc="SSE run stream with lifecycle/debug/model-token/update events and final completion/error signal." />
            <EndpointRow method="POST" path="/v1/workflows/stream" desc="Versioned alias for /stream." />
          </div>

          <CodeBlock
            lang="bash"
            code={`# Synchronous run
curl -X POST http://localhost:8000/generate \\
  -H "X-API-KEY: gsk_your_key" \\
  -H "Content-Type: application/json" \\
  -d '{"user_prompt": "A minimal FastAPI health endpoint"}'

# Per-node mutable override
curl -X POST http://localhost:8000/generate \\
  -H "X-API-KEY: gsk_your_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "user_prompt": "A minimal FastAPI health endpoint",
    "prompt_overrides": {
      "coder": "Write terse, minimal code."
    }
  }'`}
          />
        </motion.section>

        <motion.section id="prompts" variants={fadeUp} custom={0} initial="hidden" whileInView="visible" viewport={{ once: true }} style={{ marginBottom: 64 }}>
          <SectionHeading title="Prompt Schema" />
          <p style={{ fontSize: 14, color: "rgba(226,232,240,0.5)", marginBottom: 16, lineHeight: 1.8 }}>
            Prompt composition uses four parts: immutable global rules, immutable node
            prefix, mutable layer (default or override), and runtime context. Mutable
            overrides are sent per node through <code style={{ fontFamily: "'JetBrains Mono', monospace", color: "#06b6d4", fontSize: 13 }}>prompt_overrides</code>.
            Max mutable length is 4000 characters.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
            {[
              { label: "Immutable Rules", color: "#f87171", desc: "Global guardrails from config/prompts.py (highest priority)." },
              { label: "Immutable Prefix", color: "#fbbf24", desc: "Node role and hard constraints for planner/architect/coder." },
              { label: "Mutable Layer", color: "#a78bfa", desc: "Node-specific editable text from defaults or prompt_overrides." },
              { label: "Runtime Context", color: "#34d399", desc: "User prompt and prior graph outputs injected for each call." },
            ].map((p) => (
              <div key={p.label} style={{ padding: "14px 16px", borderRadius: 8, border: `1px solid ${p.color}22`, background: `${p.color}08` }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: p.color, marginBottom: 4, fontFamily: "'JetBrains Mono', monospace" }}>{p.label}</div>
                <div style={{ fontSize: 12, color: "rgba(226,232,240,0.45)" }}>{p.desc}</div>
              </div>
            ))}
          </div>
          <CodeBlock
            lang="json"
            code={`// GET /v1/prompts/schema
{
  "nodes": {
    "planner": {
      "immutable_prefix": "Role: PLANNER...",
      "default_mutable": "Generate a lean, tool-compliant plan."
    },
    "architect": { "..." },
    "coder": { "..." }
  },
  "policy": {
    "max_mutable_prompt_chars": 4000
  }
}`}
          />
        </motion.section>

        <motion.section id="workspace" variants={fadeUp} custom={0} initial="hidden" whileInView="visible" viewport={{ once: true }} style={{ marginBottom: 64 }}>
          <SectionHeading title="Workspace API" />
          <p style={{ fontSize: 14, color: "rgba(226,232,240,0.5)", marginBottom: 20, lineHeight: 1.8 }}>
            Workspace data is session-scoped and stored under a temp workspace base
            directory. Session IDs can come from query params, request body, or
            <code style={{ fontFamily: "'JetBrains Mono', monospace", color: "#06b6d4", fontSize: 13 }}> X-Workspace-ID</code> header.
            Absolute paths, drive-qualified paths, and traversal escapes are blocked.
          </p>
          <EndpointRow method="GET" path="/workspace/tree" desc="Returns hierarchical nodes for the active workspace session." />
          <EndpointRow method="GET" path="/workspace/files" desc="Returns flat UTF-8 files map and skipped_binary list." />
          <EndpointRow method="GET" path="/workspace/file" desc="Reads one text file. Requires ?path=<relative_path>." />
          <EndpointRow method="PUT" path="/workspace/file" desc="Writes one text file. Body: {path, content, workspace_id?}." />
          <EndpointRow method="POST" path="/workspace/folder" desc="Creates a folder. Body: {path, workspace_id?}." />
          <EndpointRow method="POST" path="/workspace/rename" desc="Renames path. Body: {from_path, to_path, overwrite?, workspace_id?}." />
          <EndpointRow method="DELETE" path="/workspace/path" desc="Deletes file/folder. Query: path, recursive, workspace_id?." />
          <EndpointRow method="GET" path="/workspace/download" desc="Downloads current workspace session as ZIP." />
        </motion.section>

        <motion.section id="stitching" variants={fadeUp} custom={0} initial="hidden" whileInView="visible" viewport={{ once: true }} style={{ marginBottom: 64 }}>
          <SectionHeading title="Stitching Contract" />
          <p style={{ fontSize: 14, color: "rgba(226,232,240,0.5)", marginBottom: 20, lineHeight: 1.8 }}>
            Integration contract is documented in
            <code style={{ fontFamily: "'JetBrains Mono', monospace", color: "#06b6d4", fontSize: 13 }}> README_STITCHING.md</code>.
            Mount IDs and data attributes provide a stable bridge between rendered UI
            elements and Zustand-backed runtime actions.
          </p>

          <div style={{ marginBottom: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: "#e2e8f0", marginBottom: 10 }}>Required Mount IDs</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {[
                { id: "agent-file-tree", desc: "Workspace file tree panel" },
                { id: "agent-editor", desc: "Workspace editor mount" },
                { id: "agent-graph", desc: "Live agent graph/status mount" },
                { id: "agent-logs", desc: "Streaming logs panel" },
                { id: "agent-run-button", desc: "Trigger element for agent runs" },
                { id: "agent-download-button", desc: "Trigger for workspace ZIP download" },
                { id: "agent-user-prompt", desc: "Input/textarea for the run prompt" },
              ].map((m) => (
                <div key={m.id} style={{ display: "flex", gap: 12, padding: "9px 12px", borderRadius: 6, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
                  <code style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#a78bfa", minWidth: 200, flexShrink: 0 }}>#{m.id}</code>
                  <span style={{ fontSize: 12, color: "rgba(226,232,240,0.4)" }}>{m.desc}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: "#e2e8f0", marginBottom: 10 }}>data-agent-action Values</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {[
                { action: "run-agent", desc: "Reads #agent-user-prompt and calls startAgentRun()" },
                { action: "refresh-files", desc: "Calls fetchFiles() and fetchTree()" },
                { action: "download-zip", desc: "Calls downloadWorkspaceZip()" },
                { action: "open-file", desc: "Requires data-agent-file-path, calls readFile(path)" },
                { action: "save-file", desc: "Requires data-agent-file-path + data-agent-source-id" },
              ].map((a) => (
                <div key={a.action} style={{ display: "flex", gap: 12, padding: "9px 12px", borderRadius: 6, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
                  <code style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#06b6d4", minWidth: 140, flexShrink: 0 }}>{a.action}</code>
                  <span style={{ fontSize: 12, color: "rgba(226,232,240,0.4)" }}>{a.desc}</span>
                </div>
              ))}
            </div>
          </div>

          <CodeBlock
            lang="html"
            code={`<!-- Run button -->
<button id="agent-run-button" data-agent-action="run-agent">
  Run Agent
</button>

<!-- File tree item -->
<div data-agent-action="open-file" data-agent-file-path="src/main.py">
  main.py
</div>

<!-- Download workspace -->
<button id="agent-download-button" data-agent-action="download-zip">
  Download ZIP
</button>`}
          />
        </motion.section>

      </div>
    </div>
  );
}
