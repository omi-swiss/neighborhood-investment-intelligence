"use client";

import { useState } from "react";

export function SaveAreaButton({ areaId }: { areaId: string }) {
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  async function save() {
    setState("saving");
    const response = await fetch("/api/saved-areas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ areaId }),
    });
    setState(response.ok ? "saved" : "error");
  }
  return (
    <button className={state === "saved" ? "button primary" : "button"} disabled={state === "saving"} onClick={() => void save()}>
      {state === "saving" ? "Saving…" : state === "saved" ? "✓ Saved" : state === "error" ? "Sign in to save" : "☆ Save area"}
    </button>
  );
}
