import { ReplitConnectors } from "@replit/connectors-sdk";
import { createClient } from "@replit/revenuecat-sdk/client";

const BASE_URL = "https://api.revenuecat.com/v2";

export async function getUncachableRevenueCatClient() {
  const connectors = new ReplitConnectors();

  const customFetch = async (request: Request): Promise<Response> => {
    const url = new URL(request.url);
    const path = url.pathname + url.search;

    const headers: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      headers[key] = value;
    });

    const body =
      request.method !== "GET" && request.method !== "HEAD"
        ? await request.text()
        : undefined;

    const response = await connectors.proxy("revenuecat", path, {
      method: request.method,
      headers,
      body,
    });

    return response as unknown as Response;
  };

  return createClient({
    baseUrl: BASE_URL,
    fetch: customFetch,
  });
}
