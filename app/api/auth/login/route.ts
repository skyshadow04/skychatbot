import {
  authIsConfigured,
  createSessionToken,
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  verifyPassword,
} from "@/lib/auth";

export async function POST(request: Request) {
  if (!authIsConfigured()) {
    return Response.json(
      { error: "Set SKYCHAT_PASSWORD and SKYCHAT_SESSION_SECRET in .env.local first." },
      { status: 503 },
    );
  }

  let password: unknown;
  const contentType = request.headers.get("content-type") ?? "";
  try {
    if (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      password = formData.get("password");
    } else {
      const body: unknown = await request.json();
      if (typeof body === "object" && body !== null && "password" in body) {
        password = body.password;
      }
    }
  } catch {
    return Response.json({ error: "Request body must contain a password." }, { status: 400 });
  }

  if (typeof password !== "string") {
    return Response.json({ error: "Enter the shared password." }, { status: 400 });
  }

  if (!verifyPassword(password)) {
    if (
      contentType.includes("application/x-www-form-urlencoded") ||
      contentType.includes("multipart/form-data")
    ) {
      return new Response(null, {
        status: 303,
        headers: { Location: "/login?error=invalid" },
      });
    }
    return Response.json({ error: "That password is not correct." }, { status: 401 });
  }

  const isFormPost =
    contentType.includes("application/x-www-form-urlencoded") ||
    contentType.includes("multipart/form-data");
  const response = isFormPost
    ? new Response(null, {
        status: 303,
        headers: { Location: "/" },
      })
    : Response.json({ ok: true });
  response.headers.append(
    "Set-Cookie",
    `${SESSION_COOKIE}=${createSessionToken()}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_MAX_AGE}`,
  );
  return response;
}
