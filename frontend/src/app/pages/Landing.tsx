import { NavLink } from "react-router";
import { motion } from "motion/react";
import {
  Zap,
  GitBranch,
  Code2,
  Terminal,
  Shield,
  Download,
  ArrowRight,
  ChevronRight,
  Layers,
  Network,
  FileCode2,
  Activity,
} from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] },
  }),
};

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 12px",
        borderRadius: 100,
        fontSize: 12,
        fontWeight: 500,
        color: "#a78bfa",
        background: "rgba(139,92,246,0.1)",
        border: "1px solid rgba(139,92,246,0.25)",
        fontFamily: "'JetBrains Mono', monospace",
      }}
    >
      {children}
    </span>
  );
}

function NodeCard({
  label,
  icon,
  desc,
  color,
  delay,
}: {
  label: string;
  icon: React.ReactNode;
  desc: string;
  color: string;
  delay: number;
}) {
  return (
    <motion.div
      variants={fadeUp}
      custom={delay}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      style={{
        padding: "28px 24px",
        borderRadius: 12,
        border: "1px solid rgba(255,255,255,0.07)",
        background: "rgba(255,255,255,0.025)",
        backdropFilter: "blur(8px)",
        flex: 1,
        minWidth: 200,
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 10,
          background: `${color}22`,
          border: `1px solid ${color}44`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 16,
          color,
        }}
      >
        {icon}
      </div>
      <div
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 13,
          color,
          marginBottom: 6,
          fontWeight: 600,
        }}
      >
        {label}
      </div>
      <p style={{ fontSize: 13, color: "rgba(226,232,240,0.5)", lineHeight: 1.6 }}>
        {desc}
      </p>
    </motion.div>
  );
}

function FeatureCard({
  icon,
  title,
  desc,
  delay,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  delay: number;
}) {
  return (
    <motion.div
      variants={fadeUp}
      custom={delay}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true }}
      style={{
        padding: "28px 24px",
        borderRadius: 12,
        border: "1px solid rgba(255,255,255,0.06)",
        background: "rgba(255,255,255,0.02)",
        transition: "border-color 0.2s ease",
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 10,
          background: "rgba(124,58,237,0.12)",
          border: "1px solid rgba(124,58,237,0.2)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 16,
          color: "#a78bfa",
        }}
      >
        {icon}
      </div>
      <h3
        style={{
          fontSize: 15,
          fontWeight: 600,
          color: "#e2e8f0",
          marginBottom: 8,
        }}
      >
        {title}
      </h3>
      <p style={{ fontSize: 13, color: "rgba(226,232,240,0.5)", lineHeight: 1.7 }}>
        {desc}
      </p>
    </motion.div>
  );
}

function CodeSnippet() {
  return (
    <div
      style={{
        borderRadius: 12,
        border: "1px solid rgba(255,255,255,0.08)",
        background: "#0e0e1a",
        overflow: "hidden",
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 12,
      }}
    >
      {/* titlebar */}
      <div
        style={{
          padding: "10px 16px",
          background: "rgba(255,255,255,0.03)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 6,
          }}
        >
          {["#ff5f57", "#ffbd2e", "#28c840"].map((c) => (
            <div
              key={c}
              style={{ width: 10, height: 10, borderRadius: "50%", background: c }}
            />
          ))}
        </div>
        <span style={{ color: "rgba(226,232,240,0.3)", fontSize: 11, marginLeft: 4 }}>
          graph.py
        </span>
      </div>
      <div style={{ padding: "20px 24px", lineHeight: 1.8 }}>
        <div>
          <span style={{ color: "#7c3aed" }}>from</span>
          <span style={{ color: "#e2e8f0" }}> langgraph.graph </span>
          <span style={{ color: "#7c3aed" }}>import</span>
          <span style={{ color: "#06b6d4" }}> StateGraph</span>
        </div>
        <div style={{ marginTop: 8 }}>
          <span style={{ color: "#e2e8f0" }}>workflow </span>
          <span style={{ color: "#a78bfa" }}>= </span>
          <span style={{ color: "#06b6d4" }}>StateGraph</span>
          <span style={{ color: "#e2e8f0" }}>(AgentState)</span>
        </div>
        <div style={{ marginTop: 8 }}>
          <span style={{ color: "#e2e8f0" }}>workflow.</span>
          <span style={{ color: "#34d399" }}>add_node</span>
          <span style={{ color: "#e2e8f0" }}>(</span>
          <span style={{ color: "#fbbf24" }}>"planner"</span>
          <span style={{ color: "#e2e8f0" }}>, planner_node)</span>
        </div>
        <div>
          <span style={{ color: "#e2e8f0" }}>workflow.</span>
          <span style={{ color: "#34d399" }}>add_node</span>
          <span style={{ color: "#e2e8f0" }}>(</span>
          <span style={{ color: "#fbbf24" }}>"architect"</span>
          <span style={{ color: "#e2e8f0" }}>, architect_node)</span>
        </div>
        <div>
          <span style={{ color: "#e2e8f0" }}>workflow.</span>
          <span style={{ color: "#34d399" }}>add_node</span>
          <span style={{ color: "#e2e8f0" }}>(</span>
          <span style={{ color: "#fbbf24" }}>"coder"</span>
          <span style={{ color: "#e2e8f0" }}>, coder_node)</span>
        </div>
        <div style={{ marginTop: 8, color: "rgba(226,232,240,0.3)" }}>
          # Edges: planner → architect → coder
        </div>
        <div>
          <span style={{ color: "#e2e8f0" }}>workflow.</span>
          <span style={{ color: "#34d399" }}>add_edge</span>
          <span style={{ color: "#e2e8f0" }}>(</span>
          <span style={{ color: "#fbbf24" }}>"planner"</span>
          <span style={{ color: "#e2e8f0" }}>, </span>
          <span style={{ color: "#fbbf24" }}>"architect"</span>
          <span style={{ color: "#e2e8f0" }}>)</span>
        </div>
        <div>
          <span style={{ color: "#e2e8f0" }}>workflow.</span>
          <span style={{ color: "#34d399" }}>add_edge</span>
          <span style={{ color: "#e2e8f0" }}>(</span>
          <span style={{ color: "#fbbf24" }}>"architect"</span>
          <span style={{ color: "#e2e8f0" }}>, </span>
          <span style={{ color: "#fbbf24" }}>"coder"</span>
          <span style={{ color: "#e2e8f0" }}>)</span>
        </div>
      </div>
    </div>
  );
}

export function Landing() {
  return (
    <div style={{ overflowX: "hidden" }}>
      {/* Background glow */}
      <div
        style={{
          position: "fixed",
          top: -200,
          left: "50%",
          transform: "translateX(-50%)",
          width: 800,
          height: 600,
          borderRadius: "50%",
          background:
            "radial-gradient(ellipse, rgba(124,58,237,0.12) 0%, transparent 70%)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      {/* Hero */}
      <section
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "120px 24px 80px",
          position: "relative",
          textAlign: "center",
        }}
      >
        <motion.div
          variants={fadeUp}
          custom={0}
          initial="hidden"
          animate="visible"
          style={{ marginBottom: 20 }}
        >
          <Pill>
            <Zap size={10} fill="#a78bfa" />
            LangGraph · FastAPI · Vite React · Competition Build
          </Pill>
        </motion.div>

        <motion.h1
          variants={fadeUp}
          custom={1}
          initial="hidden"
          animate="visible"
          style={{
            fontSize: "clamp(40px, 7vw, 80px)",
            fontWeight: 700,
            lineHeight: 1.1,
            letterSpacing: "-0.04em",
            color: "#f1f5f9",
            maxWidth: 860,
            marginBottom: 24,
          }}
        >
          The{" "}
          <span
            style={{
              background: "linear-gradient(135deg, #a78bfa, #06b6d4)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            Transparent
          </span>{" "}
          Agentic IDE
        </motion.h1>

        <motion.p
          variants={fadeUp}
          custom={2}
          initial="hidden"
          animate="visible"
          style={{
            fontSize: "clamp(16px, 2vw, 20px)",
            color: "rgba(226,232,240,0.55)",
            maxWidth: 600,
            lineHeight: 1.7,
            marginBottom: 40,
          }}
        >
          A 3-node LangGraph workflow — Planner → Architect → Coder — that
          generates and iterates project files with fully guarded, observable
          prompts at every step.
        </motion.p>

        <motion.div
          variants={fadeUp}
          custom={3}
          initial="hidden"
          animate="visible"
          style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}
        >
          <NavLink
            to="/studio"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "12px 24px",
              borderRadius: 8,
              fontSize: 15,
              fontWeight: 600,
              color: "#fff",
              background: "linear-gradient(135deg, #7c3aed, #6d28d9)",
              textDecoration: "none",
              boxShadow: "0 0 30px rgba(124,58,237,0.35)",
              transition: "all 0.2s ease",
            }}
          >
            <Zap size={16} />
            Open Live Studio
            <ArrowRight size={15} />
          </NavLink>
          <NavLink
            to="/docs"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "12px 24px",
              borderRadius: 8,
              fontSize: 15,
              fontWeight: 600,
              color: "rgba(226,232,240,0.8)",
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              textDecoration: "none",
            }}
          >
            <FileCode2 size={16} />
            Read Docs
          </NavLink>
        </motion.div>

        {/* Stats row */}
        <motion.div
          variants={fadeUp}
          custom={4}
          initial="hidden"
          animate="visible"
          style={{
            display: "flex",
            gap: 32,
            marginTop: 64,
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
          {[
            { val: "3", label: "Agent Nodes" },
            { val: "39", label: "Tests Passing" },
            { val: "12+", label: "API Endpoints" },
            { val: "100%", label: "Prompt Transparency" },
          ].map((s) => (
            <div key={s.label} style={{ textAlign: "center" }}>
              <div
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 28,
                  fontWeight: 700,
                  color: "#a78bfa",
                  lineHeight: 1,
                  marginBottom: 4,
                }}
              >
                {s.val}
              </div>
              <div style={{ fontSize: 12, color: "rgba(226,232,240,0.4)", fontWeight: 500 }}>
                {s.label}
              </div>
            </div>
          ))}
        </motion.div>
      </section>

      {/* Workflow section */}
      <section style={{ padding: "80px 24px", maxWidth: 1100, margin: "0 auto" }}>
        <motion.div
          variants={fadeUp}
          custom={0}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          style={{ textAlign: "center", marginBottom: 48 }}
        >
          <p
            style={{
              fontSize: 12,
              fontFamily: "'JetBrains Mono', monospace",
              color: "#7c3aed",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              marginBottom: 12,
            }}
          >
            Core Orchestration
          </p>
          <h2
            style={{
              fontSize: "clamp(28px, 4vw, 42px)",
              fontWeight: 700,
              color: "#f1f5f9",
              letterSpacing: "-0.03em",
              lineHeight: 1.2,
            }}
          >
            3-Node LangGraph Workflow
          </h2>
        </motion.div>

        {/* Nodes */}
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "stretch" }}>
          <NodeCard
            label="01 · PLANNER"
            icon={<Layers size={18} />}
            desc="Decomposes the user prompt into a structured plan. Defines goals, constraints, and the sequence of operations."
            color="#a78bfa"
            delay={0}
          />
          <div
            style={{
              display: "flex",
              alignItems: "center",
              color: "rgba(226,232,240,0.2)",
              flexShrink: 0,
            }}
          >
            <ChevronRight size={20} />
          </div>
          <NodeCard
            label="02 · ARCHITECT"
            icon={<Network size={18} />}
            desc="Takes the plan and designs the system architecture — file structure, module boundaries, and API contracts."
            color="#06b6d4"
            delay={1}
          />
          <div
            style={{
              display: "flex",
              alignItems: "center",
              color: "rgba(226,232,240,0.2)",
              flexShrink: 0,
            }}
          >
            <ChevronRight size={20} />
          </div>
          <NodeCard
            label="03 · CODER"
            icon={<Code2 size={18} />}
            desc="Implements the architecture into real, runnable project files. Writes, patches, and iterates on code."
            color="#34d399"
            delay={2}
          />
        </div>

        {/* Code snippet */}
        <motion.div
          variants={fadeUp}
          custom={3}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          style={{ marginTop: 40, maxWidth: 560, margin: "40px auto 0" }}
        >
          <CodeSnippet />
        </motion.div>
      </section>

      {/* Features */}
      <section
        style={{
          padding: "80px 24px",
          maxWidth: 1100,
          margin: "0 auto",
        }}
      >
        <motion.div
          variants={fadeUp}
          custom={0}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          style={{ textAlign: "center", marginBottom: 48 }}
        >
          <p
            style={{
              fontSize: 12,
              fontFamily: "'JetBrains Mono', monospace",
              color: "#7c3aed",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              marginBottom: 12,
            }}
          >
            What Makes It Different
          </p>
          <h2
            style={{
              fontSize: "clamp(28px, 4vw, 42px)",
              fontWeight: 700,
              color: "#f1f5f9",
              letterSpacing: "-0.03em",
            }}
          >
            Built for Transparency
          </h2>
        </motion.div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 16,
          }}
        >
          {[
            {
              icon: <Shield size={18} />,
              title: "Guarded Prompts",
              desc: "Every node uses immutable rules + immutable prefix + mutable body + context. You always see exactly what the agent receives.",
            },
            {
              icon: <Activity size={18} />,
              title: "Real-Time Streaming",
              desc: "SSE stream at /stream delivers node activity scores, severity levels, and state snapshots as the workflow runs.",
            },
            {
              icon: <Terminal size={18} />,
              title: "FastAPI Backend",
              desc: "Clean REST API with /generate, /stream, prompt schema endpoints, and full workspace CRUD with sandboxed path validation.",
            },
            {
              icon: <GitBranch size={18} />,
              title: "Prompt Schema API",
              desc: "Inspect and override any node's prompt at runtime via /api/prompts and /v1/prompts/schema — full observability.",
            },
            {
              icon: <Download size={18} />,
              title: "Workspace Download",
              desc: "Zip the entire generated workspace via /workspace/download. Full CRUD on files and folders within a safe sandbox.",
            },
            {
              icon: <Code2 size={18} />,
              title: "Stitching Contract",
              desc: "Figma-ready integration layer with Zustand store, a live editor panel, and runtime graph telemetry for the frontend.",
            },
          ].map((f, i) => (
            <FeatureCard key={f.title} {...f} delay={i * 0.1} />
          ))}
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: "80px 24px", textAlign: "center" }}>
        <div
          style={{
            maxWidth: 640,
            margin: "0 auto",
            padding: "60px 40px",
            borderRadius: 20,
            border: "1px solid rgba(139,92,246,0.2)",
            background:
              "linear-gradient(135deg, rgba(124,58,237,0.08), rgba(6,182,212,0.04))",
            backdropFilter: "blur(8px)",
          }}
        >
          <motion.div
            variants={fadeUp}
            custom={0}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            <h2
              style={{
                fontSize: "clamp(24px, 4vw, 36px)",
                fontWeight: 700,
                color: "#f1f5f9",
                letterSpacing: "-0.03em",
                marginBottom: 16,
              }}
            >
              See it in action
            </h2>
            <p
              style={{
                fontSize: 15,
                color: "rgba(226,232,240,0.5)",
                lineHeight: 1.7,
                marginBottom: 32,
              }}
            >
              Open the Live Studio to explore the agent IDE interface — file tree,
              code editor, graph visualization, and real-time logs.
            </p>
            <NavLink
              to="/studio"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "12px 28px",
                borderRadius: 8,
                fontSize: 15,
                fontWeight: 600,
                color: "#fff",
                background: "linear-gradient(135deg, #7c3aed, #6d28d9)",
                textDecoration: "none",
                boxShadow: "0 0 40px rgba(124,58,237,0.3)",
              }}
            >
              <Zap size={16} />
              Launch Live Studio
              <ArrowRight size={15} />
            </NavLink>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
