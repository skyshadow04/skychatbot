const OLLAMA_URL = "http://127.0.0.1:11434";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

function isChatMessage(value: unknown): value is ChatMessage {
  return (
    typeof value === "object" &&
    value !== null &&
    "role" in value &&
    (value.role === "user" || value.role === "assistant") &&
    "content" in value &&
    typeof value.content === "string"
  );
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  if (
    typeof body !== "object" ||
    body === null ||
    !("model" in body) ||
    typeof body.model !== "string" ||
    !body.model.trim() ||
    !("messages" in body) ||
    !Array.isArray(body.messages) ||
    body.messages.length === 0 ||
    !body.messages.every(isChatMessage)
  ) {
    return Response.json(
      { error: "Choose a model and provide at least one valid message." },
      { status: 400 },
    );
  }

  let response: Response;
  try {
    response = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: body.model,
        messages: body.messages,
        stream: true,
        keep_alive: "30m",
      }),
      signal: request.signal,
      cache: "no-store",
    });
  } catch {
    return Response.json(
      {
        error:
          "Can't reach Ollama at 127.0.0.1:11434. Make sure Ollama is running.",
      },
      { status: 503 },
    );
  }

  if (!response.ok) {
    const error = await response.text();
    return new Response(error || "Ollama could not answer this message.", {
      status: response.status,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!response.body) {
    return Response.json(
      { error: "Ollama returned an empty response." },
      { status: 502 },
    );
  }

  return new Response(response.body, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}
