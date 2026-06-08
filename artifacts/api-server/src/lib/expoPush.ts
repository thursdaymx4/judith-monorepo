interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: "default" | null;
}

interface ExpoPushTicket {
  status: "ok" | "error";
  id?: string;
  message?: string;
  details?: Record<string, unknown>;
}

interface ExpoPushResponse {
  data?: ExpoPushTicket[];
  errors?: Array<Record<string, unknown>>;
}

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

export function isExpoPushToken(value: unknown): value is string {
  return typeof value === "string" && /^ExponentPushToken\[[^\]]+\]$/.test(value);
}

export async function sendExpoPush(message: ExpoPushMessage): Promise<ExpoPushResponse> {
  const response = await fetch(EXPO_PUSH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      to: message.to,
      title: message.title,
      body: message.body,
      sound: message.sound ?? "default",
      data: message.data ?? {},
    }),
  });

  const payload = (await response.json()) as ExpoPushResponse;

  if (!response.ok) {
    const errorMessage =
      payload.errors?.[0]?.["message"] ??
      payload.data?.[0]?.message ??
      `Expo push send failed with status ${response.status}`;
    throw new Error(String(errorMessage));
  }

  return payload;
}
