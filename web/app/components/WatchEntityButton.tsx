"use client";

import { useState } from "react";

export function WatchEntityButton({
  entityType,
  entityKey,
}: {
  entityType: "area" | "property";
  entityKey: string;
}) {
  const [message, setMessage] = useState("");
  const [working, setWorking] = useState(false);

  async function watch() {
    setWorking(true);
    setMessage("");
    const response = await fetch("/api/watchlists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entityType, entityKey }),
    });
    setWorking(false);
    setMessage(response.ok ? "Monitoring enabled" : "Could not enable monitoring");
  }

  return (
    <span className="watch-action">
      <button className="button" disabled={working} onClick={() => void watch()}>
        {working ? "Adding..." : "Add to watchlist"}
      </button>
      {message ? <small role="status">{message}</small> : null}
    </span>
  );
}
