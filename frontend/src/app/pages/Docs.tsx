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

        {/* ── Overview ─────────────────────────────────────── */}
        <motion.section id="overview" variants={fadeUp} custom={0} initial="hidden" animate="visible" style={{ marginBottom: 64 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 10px", borderRadius: 100, fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: "#a78bfa", background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.2)", marginBottom: 16 }}>
            <Layers size={11} /> Overview
          </div>
          <h1 style={{ fontSize: 32, fontWeight: 700, color: "#f1f5f9", letterSpacing: "-0.03em", marginBottom: 16 }}>
            Transparent Agentic IDE
          </h1>
          <p style={{ fontSize: 14, color: "rgba(226,232,240,0.55)", lineHeight: 1.8, marginBottom: 16 }}>
            A backend + Vite frontend that runs a 3-node LangGraph workflow to generate and iterate project files.
            Every prompt is fully observable — structured as immutable rules + immutable prefix + mutable body + context.
          </p>
          <p style={{ fontSize: 14, color: "rgba(226,232,240,0.55)", lineHeight: 1.8 }}>
            Core orchestration lives in{" "}
            <code style={{ fontFamily: "'JetBrains Mono', monospace", color: "#06b6d4", fontSize: 13 }}>graph.py</code>,
            with node state models in{" "}
            <code style={{ fontFamily: "'JetBrains Mono', monospace", color: "#06b6d4", fontSize: 13 }}>state.py</code>.
            The FastAPI backend in{" "}
            <code style={{ fontFamily: "'JetBrains Mono', monospace", color: "#06b6d4", fontSize: 13 }}>api.py</code>{" "}
            exposes run, streaming, prompt schema, and workspace endpoints.
          </p>
        </motion.section>

        {/* ── Groq API Key ─────────────────────────────────── */}
        <motion.section id="groq" variants={fadeUp} custom={0} initial="hidden" whileInView="visible" viewport={{ once: true }} style={{ marginBottom: 64 }}>
          <SectionHeading title="Groq API Key" />
          <p style={{ fontSize: 14, color: "rgba(226,232,240,0.5)", marginBottom: 20, lineHeight: 1.8 }}>
            The agent uses <strong style={{ color: "#e2e8f0" }}>Groq</strong> as its LLM provider via LangChain (
            <code style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: "#06b6d4" }}>langchain-groq</code>
            ). You need a Groq API key to run the workflow. Here's everything you need to know.
          </p>

          {/* Privacy notice */}
          <div style={{ padding: "18px 20px", borderRadius: 12, background: "rgba(52,211,153,0.06)", border: "1px solid rgba(52,211,153,0.2)", marginBottom: 12, display: "flex", gap: 14, alignItems: "flex-start" }}>
            <ShieldCheck size={20} color="#34d399" style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <p style={{ fontSize: 14, fontWeight: 700, color: "#34d399", margin: "0 0 6px" }}>
                Your key is never stored on any server
              </p>
              <p style={{ fontSize: 13, color: "rgba(52,211,153,0.75)", margin: 0, lineHeight: 1.7 }}>
                When you enter your Groq API key in the Live Studio, it is saved only to{" "}
                <code style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: "#34d399" }}>localStorage</code>{" "}
                in your own browser. It is passed as the{" "}
                <code style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: "#34d399" }}>X-API-KEY</code>{" "}
                header directly to the backend — never logged, never persisted in a database, never sent to any third party
                other than Groq's API. Clearing browser storage removes it entirely.
              </p>
            </div>
          </div>

          {/* Free tier warning */}
          <div style={{ padding: "18px 20px", borderRadius: 12, background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.2)", marginBottom: 12, display: "flex", gap: 14, alignItems: "flex-start" }}>
            <AlertTriangle size={20} color="#fbbf24" style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <p style={{ fontSize: 14, fontWeight: 700, color: "#fbbf24", margin: "0 0 6px" }}>
                Groq free tier has strict rate limits
              </p>
              <p style={{ fontSize: 13, color: "rgba(251,191,36,0.75)", margin: "0 0 8px", lineHeight: 1.7 }}>
                The free plan enforces <strong style={{ color: "#fbbf24" }}>tokens-per-minute (TPM)</strong> and{" "}
                <strong style={{ color: "#fbbf24" }}>requests-per-minute (RPM)</strong> limits that can be exhausted
                mid-run on complex prompts. The 3-node workflow makes at least 3 LLM calls and can produce large
                outputs — which puts pressure on the free quota.
              </p>
              <p style={{ fontSize: 13, color: "rgba(251,191,36,0.75)", margin: 0, lineHeight: 1.7 }}>
                If you hit a <code style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>429 rate_limit_exceeded</code> error,
                wait 60 seconds and retry, or upgrade to a paid Groq plan.
              </p>
            </div>
          </div>

          {/* Good prompt tips */}
          <div style={{ padding: "18px 20px", borderRadius: 12, background: "rgba(167,139,250,0.06)", border: "1px solid rgba(167,139,250,0.2)", marginBottom: 20, display: "flex", gap: 14, alignItems: "flex-start" }}>
            <Lightbulb size={20} color="#a78bfa" style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ width: "100%" }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: "#a78bfa", margin: "0 0 10px" }}>
                Tips for staying within free limits — keep prompts small and focused
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {[
                  { good: true,  text: '"Build a Calculator webapp."' },
                  { good: true,  text: '"Create a To-do list app."' },
                  { good: true,  text: '"Make a password strength tester."' },
                  { good: false, text: '"A full e-commerce platform with auth, payments, and admin dashboard"' },
                  { good: false, text: '"A complete full-stack SaaS app with auth, billing, analytics, and tests"' },
                ].map((tip, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                    <span style={{ color: tip.good ? "#34d399" : "#f87171", fontSize: 14, flexShrink: 0 }}>
                      {tip.good ? "✓" : "✗"}
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
            code={`# Get your free key at https://console.groq.com/keys
# Then use it in the Live Studio, or pass it to the API:

curl -X POST http://localhost:8000/generate \\
  -H "X-API-KEY: gsk_your_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{"user_prompt": "A minimal FastAPI health endpoint"}'`}
          />
        </motion.section>

        {/* ── Architecture ─────────────────────────────────── */}
        <motion.section id="architecture" variants={fadeUp} custom={1} initial="hidden" whileInView="visible" viewport={{ once: true }} style={{ marginBottom: 64 }}>
          <SectionHeading title="Architecture" />
          <p style={{ fontSize: 14, color: "rgba(226,232,240,0.5)", marginBottom: 20, lineHeight: 1.8 }}>
            Python FastAPI backend + Vite React frontend connected via REST + SSE streaming.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[
              { file: "agent/graph.py",           desc: "Core LangGraph orchestration — nodes, edges, workflow entry point." },
              { file: "agent/state.py",            desc: "Pydantic state models for AgentState shared across all three nodes." },
              { file: "agent/prompts.py",          desc: "Node-specific guarded prompts (immutable rules + prefix + mutable body)." },
              { file: "config/prompts.py",         desc: "Prompt config per node — default mutable bodies and policy limits." },
              { file: "agent/api.py",              desc: "FastAPI app — run, stream, prompt schema, and workspace routes." },
              { file: "agent/workspace.py",        desc: "Sandboxed file handling — CRUD, safe path validation, zip download." },
              { file: "agent/tools.py",            desc: "Tool layer used by the coder node (read_file, write_file, list)." },
              { file: "agent/llm_factory.py",      desc: "Groq LLM instantiation via LangChain — model selection and config." },
              { file: "frontend/src/app/lib/api-client.ts",  desc: "Typed API client with X-API-KEY interceptor for all backend calls." },
              { file: "frontend/src/app/store/useAgentStore.ts", desc: "Zustand global store — single source of truth for all UI state." },
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

        {/* ── API Reference ─────────────────────────────────── */}
        <motion.section id="api" variants={fadeUp} custom={0} initial="hidden" whileInView="visible" viewport={{ once: true }} style={{ marginBottom: 64 }}>
          <SectionHeading title="API Reference" />
          <p style={{ fontSize: 14, color: "rgba(226,232,240,0.5)", marginBottom: 20, lineHeight: 1.8 }}>
            All endpoints are served by the FastAPI application in{" "}
            <code style={{ fontFamily: "'JetBrains Mono', monospace", color: "#06b6d4", fontSize: 13 }}>agent/api.py</code>.
            API key can be passed via <code style={{ fontFamily: "'JetBrains Mono', monospace", color: "#06b6d4", fontSize: 13 }}>X-API-KEY</code> header or body <code style={{ fontFamily: "'JetBrains Mono', monospace", color: "#06b6d4", fontSize: 13 }}>api_key</code> field.
          </p>

          <div style={{ marginBottom: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: "#e2e8f0", marginBottom: 2 }}>Health & Schema</h3>
            <EndpointRow method="GET" path="/health"             desc="Health check — returns {status: ok}." />
            <EndpointRow method="GET" path="/v1/prompt-policy"   desc="Returns global immutable prompt policy rules." />
            <EndpointRow method="GET" path="/api/prompts"        desc="List all prompt schemas for all nodes." />
            <EndpointRow method="GET" path="/prompts/schema"     desc="Full prompt schema with mutable/immutable sections." />
            <EndpointRow method="GET" path="/v1/prompts/schema"  desc="Versioned prompt schema endpoint (v1)." />
            <EndpointRow method="GET" path="/graph/schema"       desc="Graph schema with nodes, edges, and activity state model for live UI updates." />
          </div>

          <div style={{ marginBottom: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: "#e2e8f0", marginBottom: 2 }}>Workflow</h3>
            <EndpointRow method="POST" path="/generate"               desc="Synchronous agent run. Returns generated files on completion." />
            <EndpointRow method="POST" path="/v1/workflows/run"       desc="Versioned synchronous run endpoint." />
            <EndpointRow method="POST" path="/stream"                 desc="SSE stream — emits run_started, on_node_start, tokens, on_node_end, run_complete." />
            <EndpointRow method="POST" path="/v1/workflows/stream"    desc="Versioned streaming endpoint." />
          </div>

          <CodeBlock
            lang="bash"
            code={`# Synchronous run
curl -X POST http://localhost:8000/generate \\
  -H "X-API-KEY: gsk_your_key" \\
  -H "Content-Type: application/json" \\
  -d '{"user_prompt": "A minimal FastAPI health endpoint"}'

# Override a node's mutable prompt body
curl -X POST http://localhost:8000/generate \\
  -H "X-API-KEY: gsk_your_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "user_prompt": "A minimal FastAPI health endpoint",
    "prompt_overrides": {
      "coder": "Write terse, minimal code. No docstrings."
    }
  }'`}
          />
        </motion.section>

        {/* ── Prompt Schema ─────────────────────────────────── */}
        <motion.section id="prompts" variants={fadeUp} custom={0} initial="hidden" whileInView="visible" viewport={{ once: true }} style={{ marginBottom: 64 }}>
          <SectionHeading title="Prompt Schema" />
          <p style={{ fontSize: 14, color: "rgba(226,232,240,0.5)", marginBottom: 16, lineHeight: 1.8 }}>
            Each node uses a 4-part guarded prompt. Immutable sections ensure consistent behavior
            while the mutable body can be overridden per-run via <code style={{ fontFamily: "'JetBrains Mono', monospace", color: "#06b6d4", fontSize: 13 }}>prompt_overrides</code>.
            Max 4000 characters per mutable body.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
            {[
              { label: "Immutable Rules",  color: "#f87171", desc: "Core behavioral constraints — cannot be modified at runtime." },
              { label: "Immutable Prefix", color: "#fbbf24", desc: "Fixed context-setting header per node." },
              { label: "Mutable Body",     color: "#a78bfa", desc: "Overridable section — send via prompt_overrides in request." },
              { label: "Context",          color: "#34d399", desc: "Dynamic state injected at runtime (prior outputs, user prompt)." },
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
      "immutable_prefix": "You are the PLANNER...",
      "default_mutable": "Focus on modularity and scalability."
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

        {/* ── Workspace ─────────────────────────────────────── */}
        <motion.section id="workspace" variants={fadeUp} custom={0} initial="hidden" whileInView="visible" viewport={{ once: true }} style={{ marginBottom: 64 }}>
          <SectionHeading title="Workspace API" />
          <p style={{ fontSize: 14, color: "rgba(226,232,240,0.5)", marginBottom: 20, lineHeight: 1.8 }}>
            File handling is centralized in{" "}
            <code style={{ fontFamily: "'JetBrains Mono', monospace", color: "#06b6d4", fontSize: 13 }}>agent/workspace.py</code>.
            Workspace root is fixed to <code style={{ fontFamily: "'JetBrains Mono', monospace", color: "#06b6d4", fontSize: 13 }}>generated_project/</code>.
            Absolute paths, drive-qualified paths, and traversal escapes are blocked.
            MAX_EDITABLE_FILE_CHARS is 400,000.
          </p>
          <EndpointRow method="GET"    path="/workspace/tree"     desc="Full directory tree of the generated workspace." />
          <EndpointRow method="GET"    path="/workspace/files"    desc="Flat file list — binary files returned in skipped_binary." />
          <EndpointRow method="GET"    path="/workspace/file"     desc="Read a file. Requires ?path= query param." />
          <EndpointRow method="PUT"    path="/workspace/file"     desc="Write/update a file. Body: {path, content}." />
          <EndpointRow method="POST"   path="/workspace/folder"   desc="Create a folder. Body: {path}." />
          <EndpointRow method="POST"   path="/workspace/rename"   desc="Rename. Body: {from_path, to_path, overwrite?}." />
          <EndpointRow method="DELETE" path="/workspace/path"     desc="Delete file or folder. ?path=...&recursive=true." />
          <EndpointRow method="GET"    path="/workspace/download" desc="Download full workspace as ZIP (built in-memory)." />
        </motion.section>

        {/* ── Stitching Contract ────────────────────────────── */}
        <motion.section id="stitching" variants={fadeUp} custom={0} initial="hidden" whileInView="visible" viewport={{ once: true }} style={{ marginBottom: 64 }}>
          <SectionHeading title="Stitching Contract" />
          <p style={{ fontSize: 14, color: "rgba(226,232,240,0.5)", marginBottom: 20, lineHeight: 1.8 }}>
            Logic-first integration layer defined in{" "}
            <code style={{ fontFamily: "'JetBrains Mono', monospace", color: "#06b6d4", fontSize: 13 }}>README_STITCHING.md</code>.
            Mount IDs and data attributes connect Figma-exported UI to Zustand actions via event delegation.
          </p>

          <div style={{ marginBottom: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: "#e2e8f0", marginBottom: 10 }}>Required Mount IDs</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {[
                { id: "agent-file-tree",       desc: "Workspace file tree panel" },
                { id: "agent-editor",          desc: "Workspace editor mount" },
                { id: "agent-graph",           desc: "Live agent graph/status mount" },
                { id: "agent-logs",            desc: "Streaming logs panel" },
                { id: "agent-run-button",      desc: "Trigger element for agent runs" },
                { id: "agent-download-button", desc: "Trigger for workspace ZIP download" },
                { id: "agent-user-prompt",     desc: "Input/textarea for the run prompt" },
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
                { action: "run-agent",     desc: "Reads #agent-user-prompt, calls startAgentRun()" },
                { action: "refresh-files", desc: "Calls fetchFiles() and fetchTree()" },
                { action: "download-zip",  desc: "Calls downloadWorkspaceZip()" },
                { action: "open-file",     desc: "Requires data-agent-file-path, calls readFile(path)" },
                { action: "save-file",     desc: "Requires data-agent-file-path + data-agent-source-id" },
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


