"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Could not sign in.");
      }
      router.push("/");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not sign in.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-page">
      <form
        action="/api/auth/login"
        className="login-card"
        method="post"
        onSubmit={(event) => void signIn(event)}
      >
        <div className="brand-mark login-mark" aria-hidden="true">✦</div>
        <p className="eyebrow">PRIVATE, LOCAL AI</p>
        <h1>Welcome to Skychat</h1>
        <p className="login-copy">Enter the shared password to use this local chatbot.</p>
        <label className="login-label" htmlFor="shared-password">Shared password</label>
        <input
          autoComplete="current-password"
          autoFocus
          id="shared-password"
          name="password"
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Enter password"
          required
          type="password"
          value={password}
        />
        {error && <p className="login-error" role="alert">{error}</p>}
        <button className="login-submit" disabled={submitting} type="submit">
          {submitting ? "Signing in…" : "Continue"}
        </button>
        <p className="login-footnote">Your chats run on this device. No cloud account needed.</p>
      </form>
    </main>
  );
}
