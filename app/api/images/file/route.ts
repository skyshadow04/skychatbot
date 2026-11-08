const COMFY_URL = "http://127.0.0.1:8188";

export async function GET(request: Request) {
  const filename = new URL(request.url).searchParams.get("filename");
  if (!filename || !/^skychat_[a-zA-Z0-9_-]+\.png$/.test(filename)) {
    return Response.json({ error: "Invalid image filename." }, { status: 400 });
  }

  let response: Response;
  try {
    response = await fetch(
      `${COMFY_URL}/view?filename=${encodeURIComponent(filename)}&type=output`,
      { cache: "no-store" },
    );
  } catch {
    return Response.json({ error: "Could not load the generated image from ComfyUI." }, { status: 502 });
  }

  if (!response.ok || !response.body) {
    return Response.json(
      { error: `ComfyUI could not load the image (HTTP ${response.status}).` },
      { status: 502 },
    );
  }

  return new Response(response.body, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
