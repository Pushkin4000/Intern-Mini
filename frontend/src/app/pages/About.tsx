import { motion } from "motion/react";
import { NavLink } from "react-router";
import {
  Github,
  Trophy,
  Layers,
  Code2,
  Zap,
  ArrowRight,
  Terminal,
  Shield,
  Activity,
  Box,
} from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] },
  }),
};

const techStack = [
  {
    category: "Backend",
    color: "#a78bfa",
    items: [
      { name: "LangGraph", desc: "Workflow graph: planner -> architect -> coder (coder loops until DONE)." },
      { name: "FastAPI", desc: "REST + SSE endpoints for runs, schema, and workspace APIs." },
      { name: "Pydantic", desc: "Structured models for plan, task plan, and runtime request/response payloads." },
      { name: "LangChain + Groq", desc: "Chat model integration via langchain-groq with provider-configured model selection." },
    ],
  },
  {
    category: "Frontend",
    color: "#06b6d4",
    items: [
      { name: "Vite + React Router", desc: "SPA routing and page composition for Home, Docs, Studio, and About." },
      { name: "Zustand", desc: "Single source of truth for graph state, logs, workspace files, and prompt overrides." },
      { name: "Live Studio Editor", desc: "Built-in editor and file tree backed by workspace read/write endpoints." },
      { name: "Workflow Graph Panel", desc: "Planner/Architect/Coder status view driven by streaming SSE events." },
    ],
  },
  {
    category: "Infrastructure",
    color: "#34d399",
    items: [
      { name: "SSE Streaming", desc: "Normalized runtime events for lifecycle, debug, and incremental updates." },
      { name: "Session Workspaces", desc: "Per-session temp workspace with path validation and TTL cleanup." },
      { name: "Pytest Suite", desc: "Backend tests for prompt schema, graph execution, streaming, and workspace APIs." },
      { name: "ZIP Export", desc: "Download the current workspace as generated_project.zip." },
    ],
  },
];

export function About() {
  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "60px 24px" }}>
      {/* Header */}
      <motion.div
        variants={fadeUp}
        custom={0}
        initial="hidden"
        animate="visible"
        style={{ marginBottom: 64 }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "3px 12px",
            borderRadius: 100,
            fontSize: 11,
            fontFamily: "'JetBrains Mono', monospace",
            color: "#fbbf24",
            background: "rgba(251,191,36,0.1)",
            border: "1px solid rgba(251,191,36,0.2)",
            marginBottom: 20,
          }}
        >
          <Trophy size={11} />
          Implementation Scope
        </div>

        <h1
          style={{
            fontSize: "clamp(32px, 5vw, 52px)",
            fontWeight: 700,
            color: "#f1f5f9",
            letterSpacing: "-0.04em",
            lineHeight: 1.1,
            marginBottom: 20,
          }}
        >
          About This Project
        </h1>
        <p
          style={{
            fontSize: 16,
            color: "rgba(226,232,240,0.55)",
            lineHeight: 1.8,
            maxWidth: 600,
          }}
        >
          A transparent agent workflow workspace where prompt layers, node lifecycle,
          and generated files are visible during execution. The system is built around a
          three-node LangGraph pipeline and a session-scoped workspace API.
        </p>
      </motion.div>

      {/* Project purpose */}
      <motion.div
        variants={fadeUp}
        custom={1}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        style={{
          padding: "32px",
          borderRadius: 16,
          border: "1px solid rgba(251,191,36,0.15)",
          background: "linear-gradient(135deg, rgba(251,191,36,0.05), rgba(251,191,36,0.02))",
          marginBottom: 56,
          display: "flex",
          gap: 24,
          flexWrap: "wrap",
          alignItems: "flex-start",
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            background: "rgba(251,191,36,0.12)",
            border: "1px solid rgba(251,191,36,0.2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fbbf24",
            flexShrink: 0,
          }}
        >
          <Trophy size={22} />
        </div>
        <div style={{ flex: 1 }}>
          <h3
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: "#f1f5f9",
              marginBottom: 10,
              letterSpacing: "-0.02em",
            }}
          >
            Project Purpose
          </h3>
          <p style={{ fontSize: 14, color: "rgba(226,232,240,0.55)", lineHeight: 1.8 }}>
            The goal is operational clarity over black-box behavior. Each workflow node
            has guarded prompt layers, stream events are normalized into readable lifecycle
            signals, and generated artifacts stay inside a validated workspace that can be
            inspected, edited, and exported.
          </p>
        </div>
      </motion.div>

      {/* What makes it different */}
      <motion.section
        variants={fadeUp}
        custom={0}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        style={{ marginBottom: 56 }}
      >
        <h2
          style={{
            fontSize: 24,
            fontWeight: 700,
            color: "#f1f5f9",
            letterSpacing: "-0.03em",
            marginBottom: 24,
          }}
        >
          The Core Idea
        </h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 12,
          }}
        >
          {[
            {
              icon: <Shield size={18} />,
              title: "Guarded Prompts",
              desc: "Planner, Architect, and Coder prompts combine immutable global rules, immutable node prefix, and mutable runtime override text.",
              color: "#a78bfa",
            },
            {
              icon: <Activity size={18} />,
              title: "Workflow Observability",
              desc: "SSE emits run_started, node start/end, debug events, and run_complete so the UI can render live state transitions.",
              color: "#06b6d4",
            },
            {
              icon: <Terminal size={18} />,
              title: "Session Workspace",
              desc: "All file operations resolve against a workspace session with path traversal checks, UTF-8 safety, and CRUD endpoints.",
              color: "#34d399",
            },
            {
              icon: <Box size={18} />,
              title: "Validated Backend Contracts",
              desc: "Core behavior is covered by backend tests across prompt policy/schema, graph behavior, streaming, and workspace operations.",
              color: "#fbbf24",
            },
          ].map((item) => (
            <div
              key={item.title}
              style={{
                padding: "20px",
                borderRadius: 10,
                border: `1px solid ${item.color}18`,
                background: `${item.color}06`,
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  background: `${item.color}15`,
                  border: `1px solid ${item.color}30`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: item.color,
                  marginBottom: 12,
                }}
              >
                {item.icon}
              </div>
              <h4
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: "#e2e8f0",
                  marginBottom: 6,
                }}
              >
                {item.title}
              </h4>
              <p style={{ fontSize: 12, color: "rgba(226,232,240,0.45)", lineHeight: 1.7 }}>
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </motion.section>

      {/* Tech Stack */}
      <motion.section
        variants={fadeUp}
        custom={0}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        style={{ marginBottom: 56 }}
      >
        <h2
          style={{
            fontSize: 24,
            fontWeight: 700,
            color: "#f1f5f9",
            letterSpacing: "-0.03em",
            marginBottom: 24,
          }}
        >
          Tech Stack
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {techStack.map((group) => (
            <div key={group.category}>
              <div
                style={{
                  fontSize: 11,
                  fontFamily: "'JetBrains Mono', monospace",
                  color: group.color,
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  marginBottom: 10,
                  fontWeight: 600,
                }}
              >
                {group.category}
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                  gap: 8,
                }}
              >
                {group.items.map((item) => (
                  <div
                    key={item.name}
                    style={{
                      padding: "12px 14px",
                      borderRadius: 8,
                      border: "1px solid rgba(255,255,255,0.06)",
                      background: "rgba(255,255,255,0.02)",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: "#e2e8f0",
                        marginBottom: 2,
                      }}
                    >
                      {item.name}
                    </div>
                    <div style={{ fontSize: 11, color: "rgba(226,232,240,0.4)" }}>
                      {item.desc}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </motion.section>

      {/* Project structure summary */}
      <motion.section
        variants={fadeUp}
        custom={0}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        style={{ marginBottom: 56 }}
      >
        <h2
          style={{
            fontSize: 24,
            fontWeight: 700,
            color: "#f1f5f9",
            letterSpacing: "-0.03em",
            marginBottom: 16,
          }}
        >
          How It Works
        </h2>
        <p style={{ fontSize: 14, color: "rgba(226,232,240,0.55)", lineHeight: 1.8, marginBottom: 24 }}>
          The user submits a prompt. The LangGraph workflow runs three nodes in
          sequence, then the coder iterates file-by-file until completion:
        </p>

        <div style={{ position: "relative" }}>
          {[
            {
              step: "01",
              node: "Planner",
              color: "#a78bfa",
              desc: "Builds a structured project plan with app summary, feature list, and initial file targets.",
            },
            {
              step: "02",
              node: "Architect",
              color: "#06b6d4",
              desc: "Converts the plan into ordered implementation steps, one task per file path.",
            },
            {
              step: "03",
              node: "Coder",
              color: "#34d399",
              desc: "Executes each implementation step using read_file/list_files/write_file tools until status is DONE.",
            },
          ].map((step, i) => (
            <div
              key={step.step}
              style={{
                display: "flex",
                gap: 20,
                alignItems: "flex-start",
                marginBottom: i < 2 ? 0 : 0,
                position: "relative",
              }}
            >
              {/* Line */}
              {i < 2 && (
                <div
                  style={{
                    position: "absolute",
                    left: 19,
                    top: 40,
                    bottom: -20,
                    width: 2,
                    background: `linear-gradient(${step.color}, rgba(255,255,255,0.05))`,
                  }}
                />
              )}
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: "50%",
                  border: `2px solid ${step.color}`,
                  background: `${step.color}15`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 11,
                  fontWeight: 700,
                  color: step.color,
                  zIndex: 1,
                  position: "relative",
                }}
              >
                {step.step}
              </div>
              <div style={{ paddingBottom: i < 2 ? 32 : 0 }}>
                <div
                  style={{
                    fontSize: 15,
                    fontWeight: 700,
                    color: step.color,
                    marginBottom: 4,
                    letterSpacing: "-0.01em",
                  }}
                >
                  {step.node}
                </div>
                <p style={{ fontSize: 13, color: "rgba(226,232,240,0.5)", lineHeight: 1.7 }}>
                  {step.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </motion.section>

      {/* CTA */}
      <motion.div
        variants={fadeUp}
        custom={0}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        style={{
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <NavLink
          to="/studio"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "11px 22px",
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 600,
            color: "#fff",
            background: "linear-gradient(135deg, #7c3aed, #6d28d9)",
            textDecoration: "none",
            boxShadow: "0 0 24px rgba(124,58,237,0.3)",
          }}
        >
          <Zap size={15} />
          Open Live Studio
          <ArrowRight size={14} />
        </NavLink>
        <a
          href="https://github.com"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "11px 22px",
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 600,
            color: "rgba(226,232,240,0.7)",
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.1)",
            textDecoration: "none",
          }}
        >
          <Github size={15} />
          View on GitHub
        </a>
        <NavLink
          to="/docs"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "11px 22px",
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 600,
            color: "rgba(226,232,240,0.7)",
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.1)",
            textDecoration: "none",
          }}
        >
          <Code2 size={15} />
          Read Docs
        </NavLink>
      </motion.div>
    </div>
  );
}

