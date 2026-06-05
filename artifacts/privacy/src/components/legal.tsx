import React from "react";

export type LegalPage = "privacy" | "terms";

export function hrefFor(page: LegalPage): string {
  if (typeof window === "undefined") return `?page=${page}`;
  return `${window.location.pathname}?page=${page}`;
}

export function LegalShell({
  page,
  title,
  meta,
  intro,
  children,
}: {
  page: LegalPage;
  title: string;
  meta: string;
  intro: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ fontFamily: "'Georgia', serif", backgroundColor: "#fafaf8", minHeight: "100vh" }}>
      {/* Header */}
      <header
        style={{
          backgroundColor: "#1a1a1a",
          padding: "24px 0",
          textAlign: "center",
        }}
      >
        <div style={{ maxWidth: 760, margin: "0 auto", padding: "0 24px" }}>
          <p
            style={{
              color: "#c8a96e",
              fontSize: 13,
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              margin: "0 0 8px",
            }}
          >
            Judith
          </p>
          <h1 style={{ color: "#ffffff", fontSize: 28, fontWeight: 400, margin: 0, letterSpacing: "-0.01em" }}>
            {title}
          </h1>
          <nav style={{ marginTop: 16, fontFamily: "sans-serif", fontSize: 14 }}>
            <LegalNavLink page="privacy" current={page} label="Privacy Policy" />
            <span style={{ color: "#555", margin: "0 12px" }}>·</span>
            <LegalNavLink page="terms" current={page} label="Terms of Use" />
          </nav>
        </div>
      </header>

      {/* Content */}
      <main style={{ maxWidth: 760, margin: "0 auto", padding: "56px 24px 80px" }}>
        <p style={metaStyle}>{meta}</p>
        <p style={introStyle}>{intro}</p>

        {children}

        <hr style={{ border: "none", borderTop: "1px solid #e5e5e0", margin: "48px 0 32px" }} />
        <p style={{ ...metaStyle, textAlign: "center" }}>
          © {new Date().getFullYear()} Thursday MX. All rights reserved.
        </p>
      </main>
    </div>
  );
}

function LegalNavLink({ page, current, label }: { page: LegalPage; current: LegalPage; label: string }) {
  if (page === current) {
    return <span style={{ color: "#fff", fontWeight: 600 }}>{label}</span>;
  }
  return (
    <a href={hrefFor(page)} style={{ color: "#c8a96e", textDecoration: "none" }}>
      {label}
    </a>
  );
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 40 }}>
      <h2
        style={{
          fontSize: 18,
          fontWeight: 600,
          color: "#1a1a1a",
          fontFamily: "'Georgia', serif",
          margin: "0 0 16px",
          paddingBottom: 10,
          borderBottom: "1px solid #e5e5e0",
        }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

export function Subsection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <h3 style={{ fontSize: 15, fontWeight: 600, color: "#333", margin: "0 0 8px", fontFamily: "sans-serif" }}>
        {title}
      </h3>
      {children}
    </div>
  );
}

export const pStyle: React.CSSProperties = {
  fontSize: 16,
  lineHeight: 1.75,
  color: "#444",
  margin: "0 0 12px",
  fontFamily: "'Georgia', serif",
};

export const metaStyle: React.CSSProperties = {
  fontSize: 13,
  color: "#888",
  margin: "0 0 32px",
  fontFamily: "sans-serif",
};

export const introStyle: React.CSSProperties = {
  fontSize: 17,
  lineHeight: 1.8,
  color: "#333",
  margin: "0 0 40px",
  fontFamily: "'Georgia', serif",
  borderLeft: "3px solid #c8a96e",
  paddingLeft: 20,
};

export const ulStyle: React.CSSProperties = {
  paddingLeft: 24,
  margin: "0 0 12px",
};

export const liStyle: React.CSSProperties = {
  fontSize: 16,
  lineHeight: 1.75,
  color: "#444",
  marginBottom: 6,
  fontFamily: "'Georgia', serif",
};

export const linkStyle: React.CSSProperties = {
  color: "#8b6914",
  textDecoration: "underline",
};

export const contactBoxStyle: React.CSSProperties = {
  background: "#f4f3ef",
  border: "1px solid #e5e5e0",
  borderRadius: 8,
  padding: "20px 24px",
  marginTop: 16,
  lineHeight: 1.8,
  fontFamily: "sans-serif",
  fontSize: 15,
};
