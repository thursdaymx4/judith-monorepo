/**
 * Personas — ported 1:1 from the prototype (j-core PERSONAS, spec §3.4).
 * Drives voice + copy + avatar style. UI is English-only; greeting lines are
 * the English variants from the spec.
 */

export type PersonaId = "pro" | "funny" | "sib" | "mama" | "marites" | "britney";

export interface Persona {
  id: PersonaId;
  /** Icon name (see components/Icon). */
  icon: string;
  name: string;
  vibe: string;
  /** Greeting line (English UI). */
  line: string;
  /** If true, only shown to users whose country is PH. */
  phOnly?: boolean;
}

export const PERSONAS: Persona[] = [
  {
    id: "pro",
    icon: "spark",
    name: "Professional peer",
    vibe: "Clear · calm",
    line: "Every due date, tracked. Clear, on time — nothing slips through.",
  },
  {
    id: "funny",
    icon: "star",
    name: "Funny friend",
    vibe: "Warm · playful",
    line: "No more 'wait, that was due WHEN?' moments. I've got your back.",
  },
  {
    id: "sib",
    icon: "bell",
    name: "Sarcastic sibling",
    vibe: "Cheeky · blunt",
    line: "Your bills are handled. You're welcome — I know you'd have forgotten.",
  },
  {
    id: "mama",
    icon: "droplet",
    name: "Your Mom",
    vibe: "Caring · a little naggy",
    line: "Don't worry about the bills — I've got it. Now go eat something, please.",
  },
  {
    id: "marites",
    icon: "star",
    name: "Marites",
    vibe: "Tsismosa · makulit",
    line: "Besh! Alam ko na lahat ng bills mo — at 'di ko 'yan kakalimutan. Grabe, di ba?",
    phOnly: true,
  },
  {
    id: "britney",
    icon: "zap",
    name: "Brutal Britney",
    vibe: "Honest · brutal",
    line: "Bills. Due dates. Amounts. I track them. You pay them. That's it.",
  },
];

export function getPersona(id: PersonaId): Persona {
  return PERSONAS.find((p) => p.id === id) ?? PERSONAS[0]!;
}
