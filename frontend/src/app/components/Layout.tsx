import { useState, useEffect } from "react";
import { Outlet, NavLink, useLocation } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import { Menu, X, Zap, Github, ExternalLink } from "lucide-react";

export function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    window.scrollTo(0, 0);
  }, [location.pathname]);

  const navItems = [
    { to: "/", label: "Home" },
    { to: "/docs", label: "Docs" },
    { to: "/studio", label: "Live Studio" },
    { to: "/about", label: "About" },
  ];

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{
        background: "#080810",
        color: "#e2e8f0",
        fontFamily: "'Inter', sans-serif",
      }}
    >
      {/* Navbar */}
      <header
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          transition: "all 0.3s ease",
          background: scrolled
            ? "rgba(8,8,16,0.92)"
            : "transparent",
          backdropFilter: scrolled ? "blur(12px)" : "none",
          borderBottom: scrolled ? "1px solid rgba(139,92,246,0.15)" : "1px solid transparent",
        }}
      >
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          {/* Logo */}
          <NavLink to="/" className="flex items-center gap-2 group">
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: "linear-gradient(135deg, #7c3aed, #06b6d4)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Zap size={16} color="white" fill="white" />
            </div>
            <span
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 15,
                fontWeight: 600,
                color: "#e2e8f0",
                letterSpacing: "-0.02em",
              }}
            >
              Charito
              <span style={{ color: "#7c3aed" }}></span>
            </span>
          </NavLink>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                style={({ isActive }) => ({
                  padding: "6px 14px",
                  borderRadius: 6,
                  fontSize: 14,
                  fontWeight: 500,
                  color: isActive ? "#a78bfa" : "rgba(226,232,240,0.65)",
                  background: isActive ? "rgba(139,92,246,0.1)" : "transparent",
                  transition: "all 0.2s ease",
                  textDecoration: "none",
                })}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          {/* Right side */}
          <div className="hidden md:flex items-center gap-3">
            <a
              href="https://github.com/Pushkin4000/Intern-Mini/tree/Deploy-branch"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 14px",
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 500,
                color: "rgba(226,232,240,0.65)",
                border: "1px solid rgba(255,255,255,0.08)",
                textDecoration: "none",
                transition: "all 0.2s ease",
              }}
            >
              <Github size={14} />
              GitHub
            </a>
            <NavLink
              to="/studio"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "7px 16px",
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 600,
                color: "#fff",
                background: "linear-gradient(135deg, #7c3aed, #6d28d9)",
                textDecoration: "none",
                transition: "all 0.2s ease",
                boxShadow: "0 0 20px rgba(124,58,237,0.3)",
              }}
            >
              <Zap size={13} />
              Try Studio
            </NavLink>
          </div>

          {/* Mobile menu button */}
          <button
            className="md:hidden"
            onClick={() => setMobileOpen(!mobileOpen)}
            style={{
              background: "none",
              border: "none",
              color: "#e2e8f0",
              cursor: "pointer",
              padding: 4,
            }}
          >
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

        {/* Mobile menu */}
        <AnimatePresence>
          {mobileOpen && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              style={{
                background: "rgba(8,8,16,0.97)",
                borderBottom: "1px solid rgba(139,92,246,0.15)",
                padding: "8px 16px 16px",
              }}
            >
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === "/"}
                  style={({ isActive }) => ({
                    display: "block",
                    padding: "10px 16px",
                    borderRadius: 6,
                    fontSize: 15,
                    fontWeight: 500,
                    color: isActive ? "#a78bfa" : "rgba(226,232,240,0.75)",
                    textDecoration: "none",
                    marginBottom: 2,
                  })}
                >
                  {item.label}
                </NavLink>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Main content */}
      <main className="flex-1 pt-16">
        <Outlet />
      </main>

      {/* Footer */}
      <footer
        style={{
          borderTop: "1px solid rgba(255,255,255,0.06)",
          padding: "32px 24px",
        }}
      >
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div
              style={{
                width: 24,
                height: 24,
                borderRadius: 6,
                background: "linear-gradient(135deg, #7c3aed, #06b6d4)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Zap size={12} color="white" fill="white" />
            </div>
            <span
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 13,
                color: "rgba(226,232,240,0.4)",
              }}
            >
              Charito — Transparent Agentic IDE
            </span>
          </div>
          <div style={{ fontSize: 12, color: "rgba(226,232,240,0.3)" }}>
            Built for enthusiasts · LangGraph + FastAPI + Vite React
          </div>
        </div>
      </footer>
    </div>
  );
}

