const EMAIL_HEADER = "oai-authenticated-user-email";

export function requestUserEmail(request: Request): string | null {
  const email = request.headers.get(EMAIL_HEADER)?.trim().toLowerCase();
  if (email) return email;

  const host = new URL(request.url).hostname;
  if (host === "localhost" || host === "127.0.0.1") {
    return "local-development@nii.internal";
  }
  return null;
}
