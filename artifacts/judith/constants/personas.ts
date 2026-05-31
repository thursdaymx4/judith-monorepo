import type { Feather } from "@expo/vector-icons";

export type PersonaId = "professional" | "funny" | "sarcastic" | "mom";

type FeatherName = keyof typeof Feather.glyphMap;

export interface Persona {
  id: PersonaId;
  name: string;
  tagline: string;
  description: string;
  icon: FeatherName;
  color: string;
  sample: string;
}

export const PERSONAS: Persona[] = [
  {
    id: "professional",
    name: "Professional",
    tagline: "Malinaw at kalmado",
    description: "Clear, calm, respectful. Straight to the point.",
    icon: "briefcase",
    color: "#2DD4BF",
    sample:
      "Kumusta, ako si Judith. Ipapaalala ko sa'yo ang mga bayarin mo bago pa man sila mag-due.",
  },
  {
    id: "funny",
    name: "Funny Friend",
    tagline: "Masaya at magaan",
    description: "Upbeat and playful — still 100% accurate.",
    icon: "smile",
    color: "#FBBF24",
    sample:
      "Uy, ako si Judith! Wag kang mag-alala sa bills, ako na bahala — wala nang surprise na due date, promise!",
  },
  {
    id: "sarcastic",
    name: "Sarcastic Sibling",
    tagline: "Tuyo pero caring",
    description: "Dry and teasing, but always on your side.",
    icon: "zap",
    color: "#8B5CF6",
    sample:
      "Hi, si Judith 'to. Oo, ako na naman magpapaalala ng bills mo, kasi 'di ba, lagi mong nakakalimutan?",
  },
  {
    id: "mom",
    name: "Mama mo",
    tagline: "Mainit at maalaga",
    description: "Warm, maternal, light guilt-trip. Kumain ka na ba?",
    icon: "heart",
    color: "#F1576B",
    sample:
      "Anak, si Mama 'to — si Judith. Bantayan ko ang bayarin mo, ha. Oo nga pala, kumain ka na ba?",
  },
];

export function getPersona(id: PersonaId): Persona {
  return PERSONAS.find((p) => p.id === id) ?? PERSONAS[0]!;
}
