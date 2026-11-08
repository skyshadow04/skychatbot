const OLLAMA_URL = "http://127.0.0.1:11434";

type OllamaModel = {
  name: string;
};

export async function GET() {
  let response: Response;

  try {
    response = await fetch(`${OLLAMA_URL}/api/tags`, { cache: "no-store" });
  } catch {
    return Response.json(
      {
        error:
          "Can't reach Ollama at 127.0.0.1:11434. Start Ollama and try again.",
      },
      { status: 503 },
    );
  }

  if (!response.ok) {
    return Response.json(
      { error: `Ollama could not list models (HTTP ${response.status}).` },
      { status: 502 },
    );
  }

  const data: unknown = await response.json();
  if (
    typeof data !== "object" ||
    data === null ||
    !("models" in data) ||
    !Array.isArray(data.models)
  ) {
    return Response.json(
      { error: "Ollama returned an unexpected model list." },
      { status: 502 },
    );
  }

  const models = (data.models as OllamaModel[])
    .filter((model) => typeof model.name === "string")
    .map(({ name }) => ({ name }));

  return Response.json({ models });
}
