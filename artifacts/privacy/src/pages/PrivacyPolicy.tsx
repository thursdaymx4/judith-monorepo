import {
  LegalShell,
  Section,
  Subsection,
  pStyle,
  ulStyle,
  liStyle,
  linkStyle,
  contactBoxStyle,
} from "../components/legal";

export default function PrivacyPolicy() {
  return (
    <LegalShell
      page="privacy"
      title="Privacy Policy"
      meta="Effective date: June 3, 2026 · App: Judith – Bill Tracker · Developer: Thursday MX"
      intro="Judith is a personal finance app that helps you track bills and due dates. We take your privacy seriously. This policy explains exactly what we collect, why, and how we protect it."
    >
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
    </LegalShell>
  );
}
