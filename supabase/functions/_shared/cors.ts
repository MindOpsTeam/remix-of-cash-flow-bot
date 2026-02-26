/**
 * Shared CORS helpers for all edge functions.
 */

const DEFAULT_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Max-Age": "86400",
};

export function getCorsHeaders(
  _req: Request,
  extraHeaders?: string,
): Record<string, string> {
  if (!extraHeaders) return { ...DEFAULT_HEADERS };
  return {
    ...DEFAULT_HEADERS,
    "Access-Control-Allow-Headers": `${DEFAULT_HEADERS["Access-Control-Allow-Headers"]}, ${extraHeaders}`,
  };
}

export function corsPreflightResponse(
  req: Request,
  extraHeaders?: string,
): Response | null {
  if (req.method !== "OPTIONS") return null;
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(req, extraHeaders),
  });
}
