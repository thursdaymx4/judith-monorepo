/**
 * Personas — ported 1:1 from the prototype (j-core PERSONAS, spec §3.4).
 * Drives voice + copy + avatar style. UI is English-only; greeting lines are
 * the English variants from the spec.
 */

export type PersonaId = "pro" | "funny" | "sib" | "mama";

export interface Persona {
  id: PersonaId;
  /** Icon name (see components/Icon). */
  icon: string;
  name: string;
  vibe: string;
  /** Greeting line (English UI). */
  line: string;
}

export const PERSONAS: Persona[] = [
  {
    id: "pro",
    icon: "spark",
    name: "Professional peer",
    vibe: "Clear · calm",
    line: "I'm Judith. I'll keep your due dates handled — clear, on time, zero stress.",
  },
  {
    id: "funny",
    icon: "star",
    name: "Funny friend",
    vibe: "Warm · playful",
    line: "Hey, I'm Judith! Your personal reminder so no bill ever catches you off guard.",
  },
  {
    id: "sib",
    icon: "bell",
    name: "Sarcastic sibling",
    vibe: "Cheeky · blunt",
    line: "I'm Judith. I'll remind you about your bills… because we both know you'd forget.",
  },
  {
    id: "mama",
    icon: "droplet",
    name: "Your Mom",
    vibe: "Caring · a little naggy",
    line: "Sweetheart, it's Judith. I'll handle the bills. You — just make sure you eat well.",
  },
];

export function getPersona(id: PersonaId): Persona {
  return PERSONAS.find((p) => p.id === id) ?? PERSONAS[0]!;
}
