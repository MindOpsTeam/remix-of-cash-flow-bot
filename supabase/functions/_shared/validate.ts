/**
 * Shared validation helpers for edge functions.
 */

export async function parseJsonBody(
  req: Request
): Promise<{ data: Record<string, unknown> } | { error: string }> {
  try {
    const body = await req.json();
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return { error: "Request body must be a JSON object" };
    }
    return { data: body as Record<string, unknown> };
  } catch {
    return { error: "Invalid JSON in request body" };
  }
}

export function validate(...errors: (string | null | undefined)[]): string | null {
  const filtered = errors.filter(Boolean) as string[];
  return filtered.length > 0 ? filtered.join("; ") : null;
}

export function validateRequired(
  body: Record<string, unknown>,
  fields: string[],
): string | null {
  const missing = fields.filter((f) => body[f] === undefined || body[f] === null || body[f] === "");
  return missing.length > 0 ? `Missing required fields: ${missing.join(", ")}` : null;
}

export function validateEnum(
  value: unknown,
  name: string,
  options: string[],
): string | null {
  if (typeof value !== "string" || !options.includes(value)) {
    return `${name} must be one of: ${options.join(", ")}`;
  }
  return null;
}

export function validateUUID(value: unknown, name: string): string | null {
  if (typeof value !== "string") return `${name} must be a string`;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value) ? null : `${name} must be a valid UUID`;
}

export function validateString(value: unknown, name: string, maxLength?: number): string | null {
  if (typeof value !== "string" || value.trim().length === 0) {
    return `${name} must be a non-empty string`;
  }
  if (maxLength && value.length > maxLength) {
    return `${name} must be at most ${maxLength} characters`;
  }
  return null;
}

export function sanitizeForPrompt(text: string): string {
  return text
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .replace(/```/g, "")
    .trim()
    .slice(0, 10000);
}
