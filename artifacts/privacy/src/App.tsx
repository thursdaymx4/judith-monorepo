export default function App() {
  const lastUpdated = "June 3, 2026";

  return (
    <div style={{ fontFamily: "'Georgia', serif", backgroundColor: "#fafaf8", minHeight: "100vh" }}>
      {/* Header */}
      <header style={{
        backgroundColor: "#1a1a1a",
        padding: "24px 0",
        textAlign: "center",
      }}>
        <div style={{ maxWidth: 760, margin: "0 auto", padding: "0 24px" }}>
          <p style={{ color: "#c8a96e", fontSize: 13, letterSpacing: "0.15em", textTransform: "uppercase", margin: "0 0 8px" }}>Judith</p>
          <h1 style={{ color: "#ffffff", fontSize: 28, fontWeight: 400, margin: 0, letterSpacing: "-0.01em" }}>Privacy Policy</h1>
        </div>
      </header>

      {/* Content */}
      <main style={{ maxWidth: 760, margin: "0 auto", padding: "56px 24px 80px" }}>
        <p style={metaStyle}>Effective date: {lastUpdated} &nbsp;·&nbsp; App: Judith – Bill Tracker &nbsp;·&nbsp; Developer: Thursday MX</p>

        <p style={introStyle}>
          Judith is a personal finance app that helps you track bills and due dates. We take your privacy seriously. This policy explains exactly what we collect, why, and how we protect it.
        </p>

        <Section title="1. Information We Collect">
          <Subsection title="Account Information">
            <p style={pStyle}>When you sign in with <strong>Apple</strong> or <strong>Google</strong>, we receive your name (optional) and email address. If you use Apple's "Hide My Email" feature, we receive only the relay address Apple provides.</p>
          </Subsection>

          <Subsection title="Bill Data">
            <p style={pStyle}>You enter bill names, amounts, due dates, and categories. This data is stored in your account on our secure backend (Supabase) and is never sold or shared with third parties.</p>
          </Subsection>

          <Subsection title="AI Assistant Queries">
            <p style={pStyle}>When you use the Ask Judith feature, your message and a summary of your bill list are sent to <strong>Anthropic</strong> (Claude AI) to generate a response. We do not send your full financial history — only the context needed to answer your question. Anthropic's data practices are governed by their <a href="https://www.anthropic.com/privacy" style={linkStyle} target="_blank" rel="noopener noreferrer">Privacy Policy</a>.</p>
          </Subsection>

          <Subsection title="Voice Playback">
            <p style={pStyle}>AI responses may be read aloud using <strong>ElevenLabs</strong> text-to-speech. The text of the AI response is sent to ElevenLabs to generate audio. No personal financial data is included in these requests. ElevenLabs' data practices are governed by their <a href="https://elevenlabs.io/privacy" style={linkStyle} target="_blank" rel="noopener noreferrer">Privacy Policy</a>.</p>
          </Subsection>

          <Subsection title="Purchase Information">
            <p style={pStyle}>Subscriptions and in-app purchases are managed by <strong>RevenueCat</strong> and processed by Apple (App Store) or Google (Play Store). We do not collect or store your payment card details. RevenueCat's data practices are governed by their <a href="https://www.revenuecat.com/privacy" style={linkStyle} target="_blank" rel="noopener noreferrer">Privacy Policy</a>.</p>
          </Subsection>

          <Subsection title="Notifications">
            <p style={pStyle}>If you grant permission, we send local and push notifications to remind you of upcoming bill due dates. You can disable notifications at any time in your device Settings.</p>
          </Subsection>

          <Subsection title="Device & Usage Data">
            <p style={pStyle}>We collect minimal technical data (device type, OS version, app version, crash logs) to maintain app stability. We do not use third-party advertising trackers or analytics SDKs.</p>
          </Subsection>
        </Section>

        <Section title="2. How We Use Your Information">
          <ul style={ulStyle}>
            <li style={liStyle}>To provide and improve the Judith app experience</li>
            <li style={liStyle}>To authenticate your account securely</li>
            <li style={liStyle}>To generate AI-powered bill summaries and advice</li>
            <li style={liStyle}>To send bill due-date reminders you have opted into</li>
            <li style={liStyle}>To process subscription payments via RevenueCat</li>
            <li style={liStyle}>To diagnose crashes and improve app reliability</li>
          </ul>
          <p style={pStyle}>We do <strong>not</strong> sell, rent, or share your personal data with advertisers or data brokers.</p>
        </Section>

        <Section title="3. Data Storage & Security">
          <p style={pStyle}>Your bill data and account information are stored in <strong>Supabase</strong>, a secure cloud database platform with row-level security. Data is encrypted at rest and in transit (TLS). Our backend enforces authentication so only you can access your data.</p>
          <p style={pStyle}>Third-party services we use (Anthropic, ElevenLabs, RevenueCat, Supabase) are each bound by their own security practices and data processing agreements. We select partners with strong security reputations.</p>
        </Section>

        <Section title="4. Data Retention">
          <p style={pStyle}>Your data is retained as long as your account is active. If you delete your account, your bill data, account information, and associated records are permanently deleted within 30 days. Anonymized, aggregated usage statistics (containing no personal information) may be retained for analytics.</p>
        </Section>

        <Section title="5. Your Rights">
          <p style={pStyle}>Depending on your location, you may have the right to:</p>
          <ul style={ulStyle}>
            <li style={liStyle}><strong>Access</strong> the personal data we hold about you</li>
            <li style={liStyle}><strong>Correct</strong> inaccurate data</li>
            <li style={liStyle}><strong>Delete</strong> your account and all associated data</li>
            <li style={liStyle}><strong>Export</strong> your bill data in a portable format</li>
            <li style={liStyle}><strong>Opt out</strong> of non-essential data processing</li>
          </ul>
          <p style={pStyle}>To exercise any of these rights, email us at <a href="mailto:privacy@judithforduedates.com" style={linkStyle}>privacy@judithforduedates.com</a>.</p>
        </Section>

        <Section title="6. Children's Privacy">
          <p style={pStyle}>Judith is not intended for children under 13 years of age. We do not knowingly collect personal information from children under 13. If you believe a child has provided us with personal information, please contact us and we will delete it promptly.</p>
        </Section>

        <Section title="7. Apple Sign In & Google Sign In">
          <p style={pStyle}>When you authenticate with Apple or Google, those platforms handle your credentials — we never see your password. We receive only a unique user identifier and, optionally, your name and email. Your use of those authentication services is also governed by Apple's and Google's respective privacy policies.</p>
        </Section>

        <Section title="8. Changes to This Policy">
          <p style={pStyle}>We may update this policy from time to time. When we do, we will update the effective date at the top of this page. Significant changes will be communicated in-app. Continued use of Judith after changes constitutes acceptance of the updated policy.</p>
        </Section>

        <Section title="9. Contact Us">
          <p style={pStyle}>If you have questions or concerns about this Privacy Policy, please contact:</p>
          <div style={contactBoxStyle}>
            <p style={{ margin: "0 0 4px", fontWeight: 600, color: "#1a1a1a" }}>Thursday MX</p>
            <p style={{ margin: "0 0 4px", color: "#555" }}>Judith – Bill Tracker</p>
            <p style={{ margin: 0 }}>
              <a href="mailto:privacy@judithforduedates.com" style={linkStyle}>privacy@judithforduedates.com</a>
            </p>
            <p style={{ margin: "4px 0 0", color: "#555" }}>
              <a href="https://judithforduedates.com" style={linkStyle} target="_blank" rel="noopener noreferrer">judithforduedates.com</a>
            </p>
          </div>
        </Section>

        <hr style={{ border: "none", borderTop: "1px solid #e5e5e0", margin: "48px 0 32px" }} />
        <p style={{ ...metaStyle, textAlign: "center" }}>© {new Date().getFullYear()} Thursday MX. All rights reserved.</p>
      </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 40 }}>
      <h2 style={{
        fontSize: 18,
        fontWeight: 600,
        color: "#1a1a1a",
        fontFamily: "'Georgia', serif",
        margin: "0 0 16px",
        paddingBottom: 10,
        borderBottom: "1px solid #e5e5e0",
      }}>{title}</h2>
      {children}
    </section>
  );
}

function Subsection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <h3 style={{ fontSize: 15, fontWeight: 600, color: "#333", margin: "0 0 8px", fontFamily: "sans-serif" }}>{title}</h3>
      {children}
    </div>
  );
}

const pStyle: React.CSSProperties = {
  fontSize: 16,
  lineHeight: 1.75,
  color: "#444",
  margin: "0 0 12px",
  fontFamily: "'Georgia', serif",
};

const metaStyle: React.CSSProperties = {
  fontSize: 13,
  color: "#888",
  margin: "0 0 32px",
  fontFamily: "sans-serif",
};

const introStyle: React.CSSProperties = {
  fontSize: 17,
  lineHeight: 1.8,
  color: "#333",
  margin: "0 0 40px",
  fontFamily: "'Georgia', serif",
  borderLeft: "3px solid #c8a96e",
  paddingLeft: 20,
};

const ulStyle: React.CSSProperties = {
  paddingLeft: 24,
  margin: "0 0 12px",
};

const liStyle: React.CSSProperties = {
  fontSize: 16,
  lineHeight: 1.75,
  color: "#444",
  marginBottom: 6,
  fontFamily: "'Georgia', serif",
};

const linkStyle: React.CSSProperties = {
  color: "#8b6914",
  textDecoration: "underline",
};

const contactBoxStyle: React.CSSProperties = {
  background: "#f4f3ef",
  border: "1px solid #e5e5e0",
  borderRadius: 8,
  padding: "20px 24px",
  marginTop: 16,
  lineHeight: 1.8,
  fontFamily: "sans-serif",
  fontSize: 15,
};
