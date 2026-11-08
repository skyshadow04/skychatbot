"use client";

import Image from "next/image";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { useRouter } from "next/navigation";

type Message = {
  role: "user" | "assistant";
  content: string;
};

type Conversation = {
  id: string;
  title: string;
  updatedAt: number;
  messages: Message[];
};

type Model = {
  name: string;
};

type ImageModel = {
  id: "fast" | "realistic";
  label: string;
};

const STORAGE_KEY = "skychatbot-conversations";
const EMPTY_MESSAGES: Message[] = [];

function isConversation(value: unknown): value is Conversation {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    typeof value.id === "string" &&
    "title" in value &&
    typeof value.title === "string" &&
    "updatedAt" in value &&
    typeof value.updatedAt === "number" &&
    "messages" in value &&
    Array.isArray(value.messages) &&
    value.messages.every(
      (message) =>
        typeof message === "object" &&
        message !== null &&
        "role" in message &&
        (message.role === "user" || message.role === "assistant") &&
        "content" in message &&
        typeof message.content === "string",
    )
  );
}

function Icon({
  name,
  size = 18,
}: {
  name:
    | "plus"
    | "send"
    | "stop"
    | "chat"
    | "spark"
    | "refresh"
    | "menu"
    | "image";
  size?: number;
}) {
  const paths = {
    plus: <path d="M12 5v14M5 12h14" />,
    send: <path d="m22 2-7 20-4-9-9-4Z M22 2 11 13" />,
    stop: <rect x="6" y="6" width="12" height="12" rx="2" />,
    chat: <path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8Z" />,
    spark: <path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2L12 3Zm7 12 .9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15Z" />,
    refresh: <path d="M20 7v5h-5M4 17v-5h5m-4.1-3A8 8 0 0 1 18.4 6L20 7m-1 7a8 8 0 0 1-13.4 3L4 17" />,
    menu: <path d="M4 6h16M4 12h16M4 18h16" />,
    image: <><rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-5-5L5 21" /></>,
  };

  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  );
}

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function Home() {
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [models, setModels] = useState<Model[]>([]);
  const [selectedModel, setSelectedModel] = useState("");
  const [draft, setDraft] = useState("");
  const [loadingModels, setLoadingModels] = useState(true);
  const [modelError, setModelError] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [isWaitingForFirstToken, setIsWaitingForFirstToken] = useState(false);
  const [activeMode, setActiveMode] = useState<"chat" | "image">("chat");
  const [imageAvailable, setImageAvailable] = useState(false);
  const [imageModels, setImageModels] = useState<ImageModel[]>([]);
  const [selectedImageModel, setSelectedImageModel] = useState<ImageModel["id"]>("realistic");
  const [imageStatusError, setImageStatusError] = useState("");
  const [imagePrompt, setImagePrompt] = useState("");
  const [generatedImage, setGeneratedImage] = useState("");
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [imageStartedAt, setImageStartedAt] = useState(0);
  const [imageElapsedSeconds, setImageElapsedSeconds] = useState(0);
  const [imageError, setImageError] = useState("");
  const [chatError, setChatError] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [storageReady, setStorageReady] = useState(false);
  const messagesAreaRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const pendingChunkRef = useRef("");
  const flushFrameRef = useRef<number | null>(null);
  const streamConversationIdRef = useRef<string | null>(null);
  const shouldStickToBottomRef = useRef(true);

  const activeConversation = conversations.find(({ id }) => id === activeId);
  const messages = activeConversation?.messages ?? EMPTY_MESSAGES;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const saved = window.localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed: unknown = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            setConversations(parsed.filter(isConversation));
          }
        }
      } catch (error) {
        console.error("Could not load saved conversations:", error);
      } finally {
        setStorageReady(true);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    const timer = window.setTimeout(() => {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
      } catch (error) {
        console.error("Could not save conversations:", error);
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [conversations, storageReady]);

  useEffect(() => {
    void loadModels();
    void loadImageStatus();
  }, []);

  useEffect(() => {
    const area = messagesAreaRef.current;
    if (!area || !shouldStickToBottomRef.current) return;

    const frame = window.requestAnimationFrame(() => {
      area.scrollTop = area.scrollHeight;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [messages]);

  useEffect(
    () => () => {
      if (flushFrameRef.current !== null) {
        window.cancelAnimationFrame(flushFrameRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    if (!isGeneratingImage) return;
    const timer = window.setInterval(() => {
      setImageElapsedSeconds(Math.floor((Date.now() - imageStartedAt) / 1000));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [imageStartedAt, isGeneratingImage]);

  useEffect(() => {
    function handleShortcut(event: globalThis.KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        startNewChat();
      }
    }

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  async function loadModels() {
    setLoadingModels(true);
    setModelError("");
    try {
      const response = await fetch("/api/models", { cache: "no-store" });
      const data: unknown = await response.json();
      if (!response.ok) {
        throw new Error(
          typeof data === "object" && data !== null && "error" in data
            ? String(data.error)
            : "Could not load models.",
        );
      }

      const availableModels =
        typeof data === "object" &&
        data !== null &&
        "models" in data &&
        Array.isArray(data.models)
          ? (data.models as Model[])
          : [];
      setModels(availableModels);
      setSelectedModel((current) =>
        availableModels.some((model) => model.name === current)
          ? current
          : (availableModels[0]?.name ?? ""),
      );
      if (availableModels.length === 0) {
        setModelError("No models found. Pull a model with `ollama pull <model>`.");
      }
    } catch (error) {
      setModels([]);
      setSelectedModel("");
      setModelError(
        error instanceof Error ? error.message : "Could not connect to Ollama.",
      );
    } finally {
      setLoadingModels(false);
    }
  }

  async function loadImageStatus() {
    setImageStatusError("");
    try {
      const response = await fetch("/api/images", { cache: "no-store" });
      const data = (await response.json()) as {
        available?: boolean;
        error?: string;
        models?: ImageModel[];
        defaultModel?: ImageModel["id"];
      };
      setImageAvailable(response.ok && data.available === true);
      const availableModels = Array.isArray(data.models)
        ? data.models.filter(
            (model): model is ImageModel =>
              typeof model === "object" &&
              model !== null &&
              (model.id === "fast" || model.id === "realistic") &&
              typeof model.label === "string",
          )
        : [];
      setImageModels(availableModels);
      setSelectedImageModel((current) =>
        availableModels.some(({ id }) => id === current)
          ? current
          : availableModels.find(({ id }) => id === data.defaultModel)?.id ??
            availableModels[0]?.id ??
            "realistic",
      );
      if (!response.ok) {
        setImageStatusError(data.error ?? "Image generation is not ready.");
      }
    } catch (error) {
      setImageAvailable(false);
      setImageModels([]);
      setImageStatusError(
        error instanceof Error ? error.message : "Could not check image generation.",
      );
    }
  }

  function startNewChat() {
    setActiveId(null);
    setChatError("");
    setDraft("");
    setSidebarOpen(false);
    textareaRef.current?.focus();
  }

  function selectConversation(id: string) {
    shouldStickToBottomRef.current = true;
    setActiveId(id);
    setChatError("");
    setSidebarOpen(false);
  }

  function updateConversation(id: string, nextMessages: Message[]) {
    setConversations((current) =>
      current.map((conversation) =>
        conversation.id === id
          ? {
              ...conversation,
              messages: nextMessages,
              updatedAt: Date.now(),
            }
          : conversation,
      ),
    );
  }

  function flushAssistantChunk() {
    if (flushFrameRef.current !== null) {
      window.cancelAnimationFrame(flushFrameRef.current);
      flushFrameRef.current = null;
    }

    const content = pendingChunkRef.current;
    const conversationId = streamConversationIdRef.current;
    pendingChunkRef.current = "";
    if (!content || !conversationId) return;

    setConversations((current) =>
      current.map((conversation) =>
        conversation.id === conversationId
          ? {
              ...conversation,
              messages: conversation.messages.map((message, index) =>
                index === conversation.messages.length - 1 &&
                message.role === "assistant"
                  ? { ...message, content: message.content + content }
                  : message,
              ),
              updatedAt: Date.now(),
            }
          : conversation,
      ),
    );
  }

  function queueAssistantChunk(content: string) {
    pendingChunkRef.current += content;
    if (flushFrameRef.current !== null) return;

    flushFrameRef.current = window.requestAnimationFrame(() => {
      flushFrameRef.current = null;
      flushAssistantChunk();
    });
  }

  async function submitMessage(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const text = draft.trim();
    if (!text || !selectedModel || isStreaming) return;

    const conversationId = activeId ?? makeId();
    const currentMessages = activeConversation?.messages ?? [];
    const nextMessages: Message[] = [
      ...currentMessages,
      { role: "user", content: text },
      { role: "assistant", content: "" },
    ];
    shouldStickToBottomRef.current = true;
    streamConversationIdRef.current = conversationId;
    pendingChunkRef.current = "";
    setActiveId(conversationId);
    setDraft("");
    setChatError("");
    setIsStreaming(true);
    setIsWaitingForFirstToken(true);

    if (activeConversation) {
      updateConversation(conversationId, nextMessages);
    } else {
      setConversations((current) => [
        {
          id: conversationId,
          title: text.slice(0, 48),
          updatedAt: Date.now(),
          messages: nextMessages,
        },
        ...current,
      ]);
    }

    if (textareaRef.current) textareaRef.current.style.height = "auto";

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: selectedModel,
          messages: [
            ...currentMessages,
            { role: "user", content: text },
          ],
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(data?.error ?? "The chat request failed.");
      }
      if (!response.body) {
        throw new Error("Ollama returned an empty response.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          const part = JSON.parse(line) as {
            message?: { content?: string };
            error?: string;
          };
          if (part.error) throw new Error(part.error);
          if (part.message?.content) {
            setIsWaitingForFirstToken(false);
            queueAssistantChunk(part.message.content);
          }
        }

        if (done) break;
      }

      if (buffer.trim()) {
        const part = JSON.parse(buffer) as {
          message?: { content?: string };
          error?: string;
        };
        if (part.error) throw new Error(part.error);
        if (part.message?.content) {
          setIsWaitingForFirstToken(false);
          queueAssistantChunk(part.message.content);
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      setChatError(
        error instanceof Error ? error.message : "The chat request failed.",
      );
    } finally {
      flushAssistantChunk();
      streamConversationIdRef.current = null;
      abortRef.current = null;
      setIsStreaming(false);
      setIsWaitingForFirstToken(false);
    }
  }

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submitMessage();
    }
  }

  function stopGenerating() {
    abortRef.current?.abort();
  }

  async function generateImage(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const prompt = imagePrompt.trim();
    if (!prompt || !imageAvailable || isGeneratingImage) return;

    setIsGeneratingImage(true);
    setImageStartedAt(Date.now());
    setImageElapsedSeconds(0);
    setGeneratedImage("");
    setImageError("");

    try {
      const response = await fetch("/api/images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, model: selectedImageModel }),
      });
      const data = (await response.json()) as {
        filename?: string;
        error?: string;
      };
      if (!response.ok) throw new Error(data.error ?? "Image generation failed.");
      if (!data.filename) throw new Error("ComfyUI returned no image.");
      setGeneratedImage(
        `/api/images/file?filename=${encodeURIComponent(data.filename)}`,
      );
    } catch (error) {
      setImageError(
        error instanceof Error ? error.message : "Image generation failed.",
      );
    } finally {
      setIsGeneratingImage(false);
    }
  }

  async function signOut() {
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error("Could not sign out.");
      router.push("/login");
    } catch (error) {
      console.error("Could not sign out:", error);
      setChatError("Could not sign out. Please try again.");
    }
  }

  function deleteConversation(id: string) {
    setConversations((current) =>
      current.filter((conversation) => conversation.id !== id),
    );
    if (activeId === id) setActiveId(null);
  }

  return (
    <main className="app-shell">
      <aside className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
        <div className="sidebar-brand">
          <div className="brand-mark"><Icon name="spark" size={20} /></div>
          <span>skychat</span>
          <span className="local-tag">LOCAL</span>
        </div>

        <button className="new-chat-button" onClick={startNewChat}>
          <Icon name="plus" size={17} />
          <span>New chat</span>
          <kbd>⌘ K</kbd>
        </button>

        <div className="history-heading">YOUR CHATS</div>
        <div className="conversation-list">
          {conversations.length === 0 ? (
            <p className="empty-history">Your conversations will appear here.</p>
          ) : (
            conversations.map((conversation) => (
              <div
                className={`conversation-row ${conversation.id === activeId ? "conversation-active" : ""}`}
                key={conversation.id}
              >
                <button
                  className="conversation-button"
                  onClick={() => selectConversation(conversation.id)}
                >
                  <Icon name="chat" size={15} />
                  <span>{conversation.title}</span>
                </button>
                <button
                  aria-label={`Delete ${conversation.title}`}
                  className="delete-chat"
                  onClick={() => deleteConversation(conversation.id)}
                  title="Delete chat"
                >
                  ×
                </button>
              </div>
            ))
          )}
        </div>

        <div className="sidebar-footer">
          <span className={`status-dot ${modelError ? "status-offline" : ""}`} />
          <span>{modelError ? "Ollama unavailable" : "Private & on-device"}</span>
        </div>
      </aside>

      <section className="chat-panel">
        <header className="topbar">
          <button
            aria-label="Toggle conversation list"
            className="mobile-menu"
            onClick={() => setSidebarOpen((open) => !open)}
          >
            <Icon name="menu" />
          </button>
          <div className="model-picker">
            <span className={`status-dot ${modelError ? "status-offline" : ""}`} />
            <select
              aria-label="Choose Ollama model"
              disabled={loadingModels || models.length === 0 || isStreaming}
              onChange={(event) => setSelectedModel(event.target.value)}
              value={selectedModel}
            >
              {loadingModels && <option value="">Finding models…</option>}
              {!loadingModels && models.length === 0 && (
                <option value="">No model available</option>
              )}
              {models.map((model) => (
                <option key={model.name} value={model.name}>{model.name}</option>
              ))}
            </select>
            <button
              aria-label="Refresh model list"
              className="refresh-button"
              disabled={loadingModels}
              onClick={() => void loadModels()}
              title="Refresh models"
            >
              <Icon name="refresh" size={15} />
            </button>
          </div>
          <div className="topbar-actions">
            <div className="topbar-note"><span className="lock-icon">⌑</span> Runs on your device</div>
            <button
              aria-pressed={activeMode === "image"}
              className={`mode-button ${activeMode === "image" ? "mode-active" : ""}`}
              onClick={() => setActiveMode((mode) => mode === "chat" ? "image" : "chat")}
              title={activeMode === "chat" ? "Create an image" : "Return to chat"}
            >
              <Icon name={activeMode === "chat" ? "image" : "chat"} size={15} />
              <span>{activeMode === "chat" ? "Create image" : "Chat"}</span>
            </button>
            <button className="sign-out-button" onClick={() => void signOut()}>Sign out</button>
          </div>
        </header>

        {activeMode === "image" ? (
          <div className="image-workspace">
            <div className="image-heading">
              <div className="welcome-icon"><Icon name="image" size={23} /></div>
              <p className="eyebrow">LOCAL IMAGE GENERATION</p>
              <h1>Imagine it.<br /><span>Make it real.</span></h1>
              <p className="welcome-copy">
                Describe an image and Stable Diffusion will create it on this computer.
              </p>
            </div>
            <form className="image-form" onSubmit={(event) => void generateImage(event)}>
              <label htmlFor="image-prompt">Describe your image</label>
              <textarea
                disabled={isGeneratingImage}
                id="image-prompt"
                maxLength={1000}
                onChange={(event) => setImagePrompt(event.target.value)}
                placeholder="A tiny cabin in a snowy forest at dawn, warm light glowing through the windows…"
                rows={3}
                value={imagePrompt}
              />
              <label className="image-model-label" htmlFor="image-model">
                Image model
              </label>
              <select
                aria-label="Choose image model"
                className="image-model-select"
                disabled={isGeneratingImage || !imageAvailable}
                id="image-model"
                onChange={(event) => {
                  const value = event.target.value;
                  if (value === "fast" || value === "realistic") {
                    setSelectedImageModel(value);
                  }
                }}
                value={selectedImageModel}
              >
                {imageModels.map((model) => (
                  <option key={model.id} value={model.id}>{model.label}</option>
                ))}
              </select>
              <div className="image-form-footer">
                <span>
                  512 × 512 · {selectedImageModel === "realistic"
                    ? "More detail, slower on CPU"
                    : "Faster, less detailed"}
                </span>
                {isGeneratingImage ? (
                  <button
                    className="generate-button"
                    disabled
                  >
                    <span className="mini-loader" />
                    Generating…
                  </button>
                ) : (
                  <button
                    className="generate-button"
                    disabled={!imageAvailable || !imagePrompt.trim()}
                    type="submit"
                  >
                    <Icon name="spark" size={15} />
                    Generate image
                  </button>
                )}
              </div>
            </form>

            {imageError || imageStatusError ? (
              <div className="image-notice" role="alert">
                <span>{imageError || imageStatusError}</span>
                <button onClick={() => void loadImageStatus()}>Check again</button>
              </div>
            ) : null}

            {isGeneratingImage ? (
              <div aria-live="polite" className="image-generating">
                <span className="image-loader"><i /><i /><i /></span>
                <strong>Creating your image</strong>
                <span>
                  Running locally on the CPU can take several minutes. Realistic
                  Vision takes longer and can improve photo-style detail, but
                  cannot guarantee perfect anatomy. You can leave this page open.
                  {imageElapsedSeconds > 0 && ` ${Math.floor(imageElapsedSeconds / 60)}:${String(imageElapsedSeconds % 60).padStart(2, "0")} elapsed.`}
                </span>
              </div>
            ) : generatedImage ? (
              <div className="generated-image-card">
                <Image
                  alt={imagePrompt}
                  className="generated-image"
                  height={512}
                  src={generatedImage}
                  unoptimized
                  width={512}
                />
                <div className="generated-image-footer">
                  <span>{imagePrompt}</span>
                  <a download="skychat-image.png" href={generatedImage}>Download image</a>
                </div>
              </div>
            ) : !imageAvailable && !imageStatusError ? (
              <div className="image-notice">Checking the local image model…</div>
            ) : null}
          </div>
        ) : (
        <div
          className={`messages-area ${messages.length === 0 ? "messages-empty" : ""}`}
          onScroll={(event) => {
            const area = event.currentTarget;
            shouldStickToBottomRef.current =
              area.scrollHeight - area.scrollTop - area.clientHeight < 120;
          }}
          ref={messagesAreaRef}
        >
          {messages.length === 0 ? (
            <div className="welcome">
              <div className="welcome-icon"><Icon name="spark" size={25} /></div>
              <p className="eyebrow">YOUR PRIVATE AI SPACE</p>
              <h1>A little intelligence,<br /><span>right at home.</span></h1>
              <p className="welcome-copy">
                Ask anything. Your messages stay on this device and are answered by your local Ollama model.
              </p>
              {modelError ? (
                <div className="setup-notice">
                  <span className="setup-indicator" />
                  <span>{modelError}</span>
                  <button onClick={() => void loadModels()}>Try again</button>
                </div>
              ) : (
                <div className="prompt-suggestions">
                  {[
                    "Help me plan a focused day",
                    "Explain something in simple terms",
                    "Give me a creative writing prompt",
                  ].map((prompt) => (
                    <button
                      className="suggestion"
                      key={prompt}
                      onClick={() => {
                        setDraft(prompt);
                        textareaRef.current?.focus();
                      }}
                    >
                      <span>{prompt}</span><span className="suggestion-arrow">↗</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="message-list">
              {messages.map((message, index) => (
                <article className={`message message-${message.role}`} key={`${activeId}-${index}`}>
                  {message.role === "assistant" && (
                    <div className="assistant-avatar"><Icon name="spark" size={16} /></div>
                  )}
                  <div className="message-content">
                    <div className="message-label">
                      {message.role === "user"
                        ? "You"
                        : isWaitingForFirstToken && index === messages.length - 1
                          ? "Waking up the model"
                          : selectedModel || "Assistant"}
                    </div>
                    <div className="message-text">
                      {message.content ? (
                        <>
                          {message.content}
                          {isStreaming && index === messages.length - 1 && (
                            <span aria-hidden="true" className="streaming-cursor">▍</span>
                          )}
                        </>
                      ) : isStreaming && index === messages.length - 1 ? (
                          <span className="response-wait">
                            <span className="typing-indicator"><i /><i /><i /></span>
                            <span>
                              {isWaitingForFirstToken
                                ? "Starting the local model — the first reply can take a little longer."
                                : "Putting together a reply…"}
                            </span>
                          </span>
                        ) : null}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
        )}

        {activeMode === "chat" && <div className="composer-wrap">
          {chatError && (
            <div className="chat-error" role="alert">
              <span>{chatError}</span>
              <button onClick={() => setChatError("")} aria-label="Dismiss error">×</button>
            </div>
          )}
          <form className="composer" onSubmit={(event) => void submitMessage(event)}>
            <textarea
              aria-label="Message"
              autoComplete="off"
              disabled={!selectedModel || isStreaming}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={handleComposerKeyDown}
              placeholder={selectedModel ? "Message your local model…" : "Connect Ollama and choose a model to begin"}
              ref={textareaRef}
              rows={1}
              value={draft}
              onInput={(event) => {
                const element = event.currentTarget;
                element.style.height = "auto";
                element.style.height = `${Math.min(element.scrollHeight, 180)}px`;
              }}
            />
            {isStreaming ? (
              <button className="send-button stop-button" onClick={stopGenerating} type="button" aria-label="Stop generating">
                <Icon name="stop" size={16} />
              </button>
            ) : (
              <button className="send-button" disabled={!draft.trim() || !selectedModel} type="submit" aria-label="Send message">
                <Icon name="send" size={16} />
              </button>
            )}
          </form>
          <div className="composer-hint">Enter to send <span>·</span> Shift + Enter for a new line <span>·</span> No cloud, no account</div>
        </div>}
      </section>
    </main>
  );
}
