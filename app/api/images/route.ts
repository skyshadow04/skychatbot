import { randomInt } from "node:crypto";

const COMFY_URL = "http://127.0.0.1:8188";
const GENERATION_TIMEOUT_MS = 20 * 60 * 1000;

const IMAGE_MODELS = {
  fast: {
    id: "fast",
    label: "Stable Diffusion 1.5 · Faster",
    checkpoint: "v1-5-pruned-emaonly-fp16.safetensors",
    steps: 12,
    sampler: "euler",
    scheduler: "normal",
  },
  realistic: {
    id: "realistic",
    label: "Realistic Vision 6.0 · More detail",
    checkpoint: "Realistic_Vision_V6.0_NV_B1_fp16.safetensors",
    vae: "vae-ft-mse-840000-ema-pruned.safetensors",
    steps: 20,
    sampler: "dpmpp_2m",
    scheduler: "karras",
  },
} as const;

type ImageModelId = keyof typeof IMAGE_MODELS;
type ImageModel = (typeof IMAGE_MODELS)[ImageModelId];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

type ComfyHistoryEntry = {
  outputs?: Record<string, { images?: { filename?: string; type?: string }[] }>;
  status?: {
    status_str?: string;
    completed?: boolean;
    messages?: [string, { exception_message?: string }][];
  };
};

async function getNodeChoices(nodeName: string, inputName: string) {
  let response: Response;
  try {
    response = await fetch(`${COMFY_URL}/object_info/${nodeName}`, {
      cache: "no-store",
    });
  } catch {
    return { choices: null, error: "Can't reach ComfyUI at 127.0.0.1:8188. Start ComfyUI and try again." };
  }
  if (!response.ok) {
    return { choices: null, error: `ComfyUI returned HTTP ${response.status} while checking image models.` };
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    return { choices: null, error: "ComfyUI returned an invalid image model list." };
  }
  if (!isRecord(data) || !(nodeName in data)) {
    return { choices: null, error: "ComfyUI returned an unexpected image model list." };
  }

  const node = data[nodeName];
  if (!isRecord(node) || !isRecord(node.input) || !isRecord(node.input.required)) {
    return { choices: null, error: "ComfyUI returned an unexpected image model list." };
  }

  const options = node.input.required[inputName];
  if (!Array.isArray(options)) {
    return { choices: null, error: "ComfyUI returned an unexpected image model list." };
  }
  const choices = options[0];
  if (!Array.isArray(choices) || !choices.every((name) => typeof name === "string")) {
    return { choices: null, error: "ComfyUI returned an unexpected image model list." };
  }
  return { choices };
}

async function getImageModelAvailability() {
  const checkpoints = await getNodeChoices("CheckpointLoaderSimple", "ckpt_name");
  if (!checkpoints.choices) {
    return { available: false as const, models: [], error: checkpoints.error };
  }

  const models: ImageModel[] = [];
  if (checkpoints.choices.includes(IMAGE_MODELS.fast.checkpoint)) {
    models.push(IMAGE_MODELS.fast);
  }

  if (checkpoints.choices.includes(IMAGE_MODELS.realistic.checkpoint)) {
    const vaes = await getNodeChoices("VAELoader", "vae_name");
    if (vaes.choices?.includes(IMAGE_MODELS.realistic.vae)) {
      models.unshift(IMAGE_MODELS.realistic);
    }
  }

  if (models.length === 0) {
    return {
      available: false as const,
      models,
      error: "No supported image checkpoint is loaded. Install a supported checkpoint, then refresh.",
    };
  }

  return { available: true as const, models };
}

export async function GET() {
  const status = await getImageModelAvailability();
  return Response.json(
    {
      ...status,
      defaultModel: status.models.some(({ id }) => id === "realistic")
        ? "realistic"
        : status.models[0]?.id,
    },
    { status: status.available ? 200 : 503 },
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
    !("prompt" in body) ||
    typeof body.prompt !== "string" ||
    !body.prompt.trim() ||
    body.prompt.length > 1000
  ) {
    return Response.json(
      { error: "Enter an image prompt of up to 1,000 characters." },
      { status: 400 },
    );
  }

  const modelId =
    "model" in body && typeof body.model === "string" ? body.model : "fast";
  if (!Object.hasOwn(IMAGE_MODELS, modelId)) {
    return Response.json({ error: "Choose one of the supported image models." }, { status: 400 });
  }
  const model = IMAGE_MODELS[modelId as ImageModelId];

  const availability = await getImageModelAvailability();
  if (!availability.available || !availability.models.some(({ id }) => id === model.id)) {
    return Response.json(
      { error: availability.error ?? "The selected image model is not available in ComfyUI." },
      { status: 503 },
    );
  }

  const workflow = {
    "1": {
      class_type: "CheckpointLoaderSimple",
      inputs: { ckpt_name: model.checkpoint },
    },
    "2": {
      class_type: "CLIPTextEncode",
      inputs: { text: body.prompt.trim(), clip: ["1", 1] },
    },
    "3": {
      class_type: "CLIPTextEncode",
      inputs: {
        text: model.id === "realistic"
          ? "(deformed iris, deformed pupils, semi-realistic, cgi, 3d, render, sketch, cartoon, drawing, anime), text, cropped, out of frame, worst quality, low quality, jpeg artifacts, ugly, duplicate, morbid, mutilated, extra fingers, mutated hands, poorly drawn hands, poorly drawn face, mutation, deformed, blurry, dehydrated, bad anatomy, bad proportions, extra limbs, cloned face, disfigured, gross proportions, malformed limbs, missing arms, missing legs, extra arms, extra legs, fused fingers, too many fingers, long neck"
          : "blurry, low quality, distorted, deformed, watermark, text",
        clip: ["1", 1],
      },
    },
    "4": {
      class_type: "EmptyLatentImage",
      inputs: { width: 512, height: 512, batch_size: 1 },
    },
    "5": {
      class_type: "KSampler",
      inputs: {
        model: ["1", 0],
        positive: ["2", 0],
        negative: ["3", 0],
        latent_image: ["4", 0],
        seed: randomInt(0, 2 ** 31),
        steps: model.steps,
        cfg: 7,
        sampler_name: model.sampler,
        scheduler: model.scheduler,
        denoise: 1,
      },
    },
    ...(model.id === "realistic"
      ? {
          "8": {
            class_type: "VAELoader",
            inputs: { vae_name: model.vae },
          },
        }
      : {}),
    "6": {
      class_type: "VAEDecode",
      inputs: { samples: ["5", 0], vae: model.id === "realistic" ? ["8", 0] : ["1", 2] },
    },
    "7": {
      class_type: "SaveImage",
      inputs: { images: ["6", 0], filename_prefix: "skychat" },
    },
  };

  let queued: Response;
  try {
    queued = await fetch(`${COMFY_URL}/prompt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: workflow }),
      signal: request.signal,
      cache: "no-store",
    });
  } catch {
    return Response.json(
      { error: "Could not queue the image in ComfyUI. Check that it is running." },
      { status: 502 },
    );
  }

  if (!queued.ok) {
    const detail = await queued.text();
    return Response.json(
      { error: `ComfyUI could not start image generation: ${detail.slice(0, 500)}` },
      { status: 502 },
    );
  }

  const queueData: unknown = await queued.json();
  if (
    typeof queueData !== "object" ||
    queueData === null ||
    !("prompt_id" in queueData) ||
    typeof queueData.prompt_id !== "string"
  ) {
    return Response.json({ error: "ComfyUI returned an invalid queue response." }, { status: 502 });
  }
  const promptId = queueData.prompt_id;

  const deadline = Date.now() + GENERATION_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (request.signal.aborted) {
      return Response.json({ error: "Image generation was cancelled." }, { status: 499 });
    }

    await new Promise((resolve) => setTimeout(resolve, 1500));
    let historyResponse: Response;
    try {
      historyResponse = await fetch(
        `${COMFY_URL}/history/${encodeURIComponent(promptId)}`,
        { cache: "no-store", signal: request.signal },
      );
    } catch {
      if (request.signal.aborted) {
        return Response.json({ error: "Image generation was cancelled." }, { status: 499 });
      }
      return Response.json({ error: "Lost the connection to ComfyUI while generating." }, { status: 502 });
    }

    if (!historyResponse.ok) {
      return Response.json(
        { error: `ComfyUI returned HTTP ${historyResponse.status} while checking the result.` },
        { status: 502 },
      );
    }

    const history: unknown = await historyResponse.json();
    const entry =
      typeof history === "object" &&
      history !== null &&
      promptId in history
        ? (history as Record<string, ComfyHistoryEntry>)[promptId]
        : undefined;
    if (!entry?.status?.completed) continue;

    if (entry.status.status_str !== "success") {
      const errorMessage = entry.status.messages?.find(
        ([type]) => type === "execution_error",
      )?.[1]?.exception_message;
      return Response.json(
        { error: errorMessage ?? "ComfyUI could not generate this image." },
        { status: 502 },
      );
    }

    const images = entry.outputs?.["7"]?.images;
    const filename = images?.[0]?.filename;
    if (!filename || !/^skychat_[a-zA-Z0-9_-]+\.png$/.test(filename)) {
      return Response.json(
        { error: "ComfyUI finished but did not return a valid image." },
        { status: 502 },
      );
    }

    return Response.json({ filename });
  }

  return Response.json(
    { error: "Image generation took longer than 20 minutes. Try a simpler prompt." },
    { status: 504 },
  );
}
