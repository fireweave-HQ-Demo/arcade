const BASE = process.env.OPENOBSERVE_URL ?? "";
const USER = process.env.OPENOBSERVE_USER ?? "";
const PASS = process.env.OPENOBSERVE_PASSWORD ?? "";

type MetricEvent = {
  _timestamp?: number;
  event: string;
  user?: string;
  game_id?: number;
  result?: string;
  detail?: string;
};

export async function track(event: MetricEvent): Promise<void> {
  if (!BASE || !USER || !PASS) return;

  const body = [
    {
      ...event,
      _timestamp: event._timestamp ?? Date.now() * 1000,
      service: "temp-battle",
    },
  ];

  try {
    const auth = Buffer.from(`${USER}:${PASS}`).toString("base64");
    await fetch(`${BASE}/temp_battle/_json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch {
    // metrics must never break gameplay
  }
}

export async function listStreams(): Promise<unknown> {
  if (!BASE || !USER || !PASS) return { error: "metrics not configured" };
  const auth = Buffer.from(`${USER}:${PASS}`).toString("base64");
  const res = await fetch(`${BASE}/streams`, {
    headers: {
      Authorization: `Basic ${auth}`,
      Accept: "application/json",
    },
  });
  return res.json();
}
