import { requireApiUser } from "../../../../lib/access-control";

export const runtime = "edge";

export async function GET() {
  const auth = await requireApiUser();
  if (!auth.user) return auth.response;

  const publicKey = (process.env.VAPID_PUBLIC_KEY ?? "").trim();
  const enabled = Boolean(
    publicKey &&
    process.env.VAPID_PRIVATE_KEY?.trim() &&
    process.env.VAPID_SUBJECT?.trim(),
  );
  const response = Response.json({
    enabled,
    publicKey: enabled ? publicKey : "",
  });
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
