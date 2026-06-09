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
      meta="Effective date: June 9, 2026 · App: Judith – Bill Tracker · Developer: Thursday MX"
      intro="Judith is a personal finance app that helps you track bills and due dates. We take your privacy seriously. This policy explains exactly what data leaves your device, why, and how we protect it."
    >
      <Section title="1. How Your Bill Data Is Stored">
        <p style={pStyle}>
          Your bill data — names, amounts, due dates, and categories — is stored{" "}
          <strong>locally on your device</strong> using on-device storage. It is
          not continuously uploaded to our servers during normal app use.
        </p>
        <p style={pStyle}>
          <strong>iCloud Backup (signed-in users).</strong> If you are signed
          in, Judith automatically backs up your data to your private iCloud
          container (<code>iCloud.com.app.judith</code>). This backup is
          associated with your account so that only you can restore it — for
          example, after reinstalling or switching devices. The backup is stored
          in your personal iCloud storage, not on Judith's servers.
        </p>
        <p style={pStyle}>
          <strong>Apple Watch &amp; Home Screen Widget.</strong> Bill summaries
          shown on your Apple Watch and widget are shared entirely on-device
          through Apple's App Group storage and WatchConnectivity. No bill data
          is transmitted to our servers for watch or widget display.
        </p>
      </Section>

      <Section title="2. Information We Collect">
        <Subsection title="Account Information">
          <p style={pStyle}>
            When you sign in with <strong>Apple</strong> or{" "}
            <strong>Google</strong>, we receive your name (optional) and email
            address via <strong>Supabase Auth</strong>. If you use Apple's "Hide
            My Email" feature, we receive only the relay address Apple provides.
            Supabase is used for authentication only — your bill data is not
            stored in our cloud database.
          </p>
        </Subsection>

        <Subsection title="AI Assistant (Ask Judith)">
          <p style={pStyle}>
            When you use the <strong>Ask Judith</strong> feature, your question
            and your current bill list (including amounts, due dates, and
            payment status) are sent to Judith's backend server, which uses{" "}
            <strong>Anthropic</strong> (Claude AI) to generate a response. This
            context is used only to answer your question and is not retained by
            Judith after the request completes. Anthropic's data practices are
            governed by their{" "}
            <a
              href="https://www.anthropic.com/privacy"
              style={linkStyle}
              target="_blank"
              rel="noopener noreferrer"
            >
              Privacy Policy
            </a>
            .
          </p>
        </Subsection>

        <Subsection title="Voice Queries">
          <p style={pStyle}>
            When you ask a question using your voice, your audio recording is
            sent to Judith's backend for transcription. The transcribed text is
            then processed as an AI query (see above). Audio is used only to
            transcribe your question and is not stored by Judith after the
            request completes.
          </p>
        </Subsection>

        <Subsection title="Voice Playback (Text-to-Speech)">
          <p style={pStyle}>
            AI responses may be read aloud using <strong>ElevenLabs</strong>{" "}
            text-to-speech. The text of the AI response is sent to ElevenLabs
            to generate audio. No additional personal financial data beyond the
            reply text is included in these requests. ElevenLabs' data practices
            are governed by their{" "}
            <a
              href="https://elevenlabs.io/privacy"
              style={linkStyle}
              target="_blank"
              rel="noopener noreferrer"
            >
              Privacy Policy
            </a>
            .
          </p>
        </Subsection>

        <Subsection title="Scan a Bill (Screenshot Import)">
          <p style={pStyle}>
            When you use the Scan feature to import subscriptions from a
            screenshot, the image is sent to Judith's backend and passed to{" "}
            <strong>Anthropic</strong>'s vision API to extract bill details. The
            image is processed in transit only — it is not stored by Judith or
            retained after the extraction is complete.
          </p>
        </Subsection>

        <Subsection title="Purchase Information">
          <p style={pStyle}>
            Subscriptions and in-app purchases are managed by{" "}
            <strong>RevenueCat</strong> and processed by Apple (App Store) or
            Google (Play Store). Subscription status is checked through
            RevenueCat when you use the app. We do not collect or store your
            payment card details. RevenueCat's data practices are governed by
            their{" "}
            <a
              href="https://www.revenuecat.com/privacy"
              style={linkStyle}
              target="_blank"
              rel="noopener noreferrer"
            >
              Privacy Policy
            </a>
            .
          </p>
        </Subsection>

        <Subsection title="Notifications">
          <p style={pStyle}>
            Bill reminders and nudges are delivered as{" "}
            <strong>local notifications</strong> scheduled on your device — they
            do not require a server round-trip. If you grant permission, push
            notifications may also be delivered via Expo's push service. You can
            disable notifications at any time in your device Settings.
          </p>
        </Subsection>

        <Subsection title="Device & Usage Data">
          <p style={pStyle}>
            We collect minimal technical data (device type, OS version, app
            version, crash logs) to maintain app stability. We do not use
            third-party advertising trackers or analytics SDKs.
          </p>
        </Subsection>
      </Section>

      <Section title="3. Summary: What Leaves Your Device">
        <ul style={ulStyle}>
          <li style={liStyle}>
            <strong>Never (normal use):</strong> Your bill list, amounts, and
            due dates stay on-device during regular browsing, calendar, and
            insights use.
          </li>
          <li style={liStyle}>
            <strong>iCloud only:</strong> A full encrypted backup goes to your
            private iCloud storage when you are signed in.
          </li>
          <li style={liStyle}>
            <strong>When you use Ask Judith or voice queries:</strong> Your bill
            list and financial context are sent to our backend and Anthropic.
          </li>
          <li style={liStyle}>
            <strong>When you use voice input:</strong> Your audio recording is
            sent to our backend for transcription.
          </li>
          <li style={liStyle}>
            <strong>When you use Scan:</strong> Your screenshot image is sent to
            our backend and Anthropic for extraction. The image is not stored.
          </li>
          <li style={liStyle}>
            <strong>Always:</strong> Subscription status is checked with
            RevenueCat. Authentication is handled by Supabase Auth.
          </li>
        </ul>
      </Section>

      <Section title="4. How We Use Your Information">
        <ul style={ulStyle}>
          <li style={liStyle}>To provide and improve the Judith app experience</li>
          <li style={liStyle}>To authenticate your account securely</li>
          <li style={liStyle}>To generate AI-powered bill summaries and advice</li>
          <li style={liStyle}>To transcribe voice queries</li>
          <li style={liStyle}>To extract bill details from scanned screenshots</li>
          <li style={liStyle}>To send bill due-date reminders you have opted into</li>
          <li style={liStyle}>To process subscription payments via RevenueCat</li>
          <li style={liStyle}>To diagnose crashes and improve app reliability</li>
        </ul>
        <p style={pStyle}>
          We do <strong>not</strong> sell, rent, or share your personal data
          with advertisers or data brokers.
        </p>
      </Section>

      <Section title="5. Data Storage & Security">
        <p style={pStyle}>
          Your bill data is stored locally on your device and, for signed-in
          users, backed up to your private iCloud container. Authentication
          information is stored in <strong>Supabase</strong>, a secure cloud
          platform with row-level security, encryption at rest, and TLS in
          transit.
        </p>
        <p style={pStyle}>
          Third-party services we use (Anthropic, ElevenLabs, RevenueCat,
          Supabase) are each bound by their own security practices and data
          processing agreements. We select partners with strong security
          reputations.
        </p>
      </Section>

      <Section title="6. Data Retention">
        <p style={pStyle}>
          Your account information is retained as long as your account is
          active. If you delete your account, your account information and
          associated records are permanently deleted within 30 days. Because
          bill data is stored locally and in your iCloud, deleting the app or
          your iCloud backup removes that data from those locations. Anonymized,
          aggregated usage statistics (containing no personal information) may
          be retained for analytics.
        </p>
      </Section>

      <Section title="7. Your Rights">
        <p style={pStyle}>Depending on your location, you may have the right to:</p>
        <ul style={ulStyle}>
          <li style={liStyle}><strong>Access</strong> the personal data we hold about you</li>
          <li style={liStyle}><strong>Correct</strong> inaccurate data</li>
          <li style={liStyle}><strong>Delete</strong> your account and all associated data</li>
          <li style={liStyle}><strong>Export</strong> your bill data in a portable format</li>
          <li style={liStyle}><strong>Opt out</strong> of non-essential data processing</li>
        </ul>
        <p style={pStyle}>
          To exercise any of these rights, email us at{" "}
          <a href="mailto:privacy@judithforduedates.com" style={linkStyle}>
            privacy@judithforduedates.com
          </a>
          .
        </p>
      </Section>

      <Section title="8. Children's Privacy">
        <p style={pStyle}>
          Judith is not intended for children under 13 years of age. We do not
          knowingly collect personal information from children under 13. If you
          believe a child has provided us with personal information, please
          contact us and we will delete it promptly.
        </p>
      </Section>

      <Section title="9. Apple Sign In & Google Sign In">
        <p style={pStyle}>
          When you authenticate with Apple or Google, those platforms handle
          your credentials — we never see your password. We receive only a
          unique user identifier and, optionally, your name and email. Your use
          of those authentication services is also governed by Apple's and
          Google's respective privacy policies.
        </p>
      </Section>

      <Section title="10. Changes to This Policy">
        <p style={pStyle}>
          We may update this policy from time to time. When we do, we will
          update the effective date at the top of this page. Significant changes
          will be communicated in-app. Continued use of Judith after changes
          constitutes acceptance of the updated policy.
        </p>
      </Section>

      <Section title="11. Contact Us">
        <p style={pStyle}>
          If you have questions or concerns about this Privacy Policy, please
          contact:
        </p>
        <div style={contactBoxStyle}>
          <p style={{ margin: "0 0 4px", fontWeight: 600, color: "#1a1a1a" }}>Thursday MX</p>
          <p style={{ margin: "0 0 4px", color: "#555" }}>Judith – Bill Tracker</p>
          <p style={{ margin: 0 }}>
            <a href="mailto:privacy@judithforduedates.com" style={linkStyle}>
              privacy@judithforduedates.com
            </a>
          </p>
          <p style={{ margin: "4px 0 0", color: "#555" }}>
            <a
              href="https://judithforduedates.com"
              style={linkStyle}
              target="_blank"
              rel="noopener noreferrer"
            >
              judithforduedates.com
            </a>
          </p>
        </div>
      </Section>
    </LegalShell>
  );
}
