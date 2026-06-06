import { getAnthropic } from "./anthropic";

/**
 * Fast, cheap pre-TTS content moderation using Claude Haiku.
 *
 * ElevenLabs prohibits "fraudulent, predatory, or abusive" content.
 * We screen every AI-generated reply and user-submitted TTS text before
 * sending it to ElevenLabs. On any error we fail OPEN so legitimate use
 * is never blocked by a transient API issue.
 *
 * Returns true = safe to synthesize, false = skip TTS (return text-only).
 */
export async function isSafeForTTS(text: string): Promise<boolean> {
  if (!text.trim()) return true;
  try {
    const anthropic = getAnthropic();
    const msg = await anthropic.messages.create({
      model: "claude-3-5-haiku-20241022",
      max_tokens: 16,
      system: `You are a content safety filter for a personal finance bill-tracking app.
The app helps users track bills, due dates, and payment reminders.

Respond ONLY with the word SAFE or UNSAFE.

Mark UNSAFE only if the text contains:
- Threats or violence
- Hate speech or harassment
- Explicit sexual content
- Instructions for fraud, scams, or illegal activity
- Impersonation or social engineering attacks
- Content designed to deceive or manipulate a real person into financial harm

Bill tracking content (amounts, due dates, payment reminders, financial summaries) is ALWAYS SAFE regardless of the amounts or tone.`,
      messages: [{ role: "user", content: text }],
    });

    const verdict = (msg.content[0] as { type: string; text: string }).text
      .trim()
      .toUpperCase();
    return verdict === "SAFE";
  } catch {
    // Fail open: a moderation API hiccup should never silence legitimate replies.
    return true;
  }
}
