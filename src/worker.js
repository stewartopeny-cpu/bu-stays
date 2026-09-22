const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };

const reply = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), { status, headers: { ...JSON_HEADERS, ...headers } });

function cookies(request) {
  return Object.fromEntries((request.headers.get("cookie") || "").split(";").map(v => v.trim().split("=")).filter(v => v.length === 2));
}

async function signature(value, secret) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const bytes = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map(v => v.toString(16).padStart(2, "0")).join("");
}

async function isManager(request, env) {
  if (!env.MANAGER_AUTH_SECRET) return false;
  const value = cookies(request).busitema_manager;
  if (!value) return false;
  const [expires, sent] = value.split(".");
  if (!expires || !sent || Number(expires) < Date.now()) return false;
  return sent === await signature(expires, env.MANAGER_AUTH_SECRET);
}

const dbRequired = env => {
  if (!env.DB) throw new Error("Database not connected. Add a D1 binding named DB.");
  return env.DB;
};

async function body(request) {
  try { return await request.json(); } catch { return {}; }
}

async function api(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;

  if (path === "/api/status") {
    return reply({ online: true, database: Boolean(env.DB), email: Boolean(env.RESEND_API_KEY) });
  }

  if (path === "/api/hostels" && request.method === "GET") {
    if (!env.DB) return reply({ hostels: [], database: false });
    const result = await env.DB.prepare("SELECT name, payload, status, updated_at FROM hostel_edits ORDER BY name").all();
    return reply({ hostels: result.results.map(row => ({ ...JSON.parse(row.payload || "{}"), name: row.name, status: row.status, updatedAt: row.updated_at })), database: true });
  }

  if (path === "/api/bookings" && request.method === "POST") {
    const input = await body(request);
    for (const key of ["hostelName", "fullName", "phone", "roomType"]) {
      if (!String(input[key] || "").trim()) return reply({ error: `Missing ${key}` }, 400);
    }
    const reference = `BS-${Date.now().toString(36).toUpperCase()}`;
    await dbRequired(env).prepare(
      "INSERT INTO bookings (reference, hostel_name, full_name, phone, email, room_type, gender, move_in_date, message) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).bind(reference, input.hostelName, input.fullName, input.phone, input.email || null, input.roomType, input.gender || "Not specified", input.moveInDate || "Not specified", input.message || null).run();
    return reply({ ok: true, reference }, 201);
  }

  if (path === "/api/manager/login" && request.method === "POST") {
    const input = await body(request);
    if (!env.MANAGER_PASSWORD || input.password !== env.MANAGER_PASSWORD) return reply({ error: "Incorrect manager password" }, 401);
    if (!env.MANAGER_AUTH_SECRET) return reply({ error: "MANAGER_AUTH_SECRET is not configured" }, 503);
    const expires = String(Date.now() + 8 * 60 * 60 * 1000);
    const token = `${expires}.${await signature(expires, env.MANAGER_AUTH_SECRET)}`;
    return reply({ ok: true }, 200, { "set-cookie": `busitema_manager=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=28800` });
  }

  if (path === "/api/manager/logout" && request.method === "POST") {
    return reply({ ok: true }, 200, { "set-cookie": "busitema_manager=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0" });
  }

  if (path.startsWith("/api/manager/") && !(await isManager(request, env))) return reply({ error: "Manager login required" }, 401);

  if (path === "/api/manager/hostels" && request.method === "GET") {
    if (!env.DB) return reply({ hostels: [], database: false });
    const result = await env.DB.prepare("SELECT name, payload, status, updated_at FROM hostel_edits ORDER BY name").all();
    return reply({ hostels: result.results.map(row => ({ ...JSON.parse(row.payload || "{}"), name: row.name, status: row.status, updatedAt: row.updated_at })), database: true });
  }

  if (path === "/api/manager/hostels" && request.method === "PUT") {
    const input = await body(request);
    if (!String(input.name || "").trim()) return reply({ error: "Hostel name is required" }, 400);
    const name = String(input.name).trim();
    const status = input.status === "inactive" ? "inactive" : "active";
    const payload = JSON.stringify({ ...input, name: undefined, status: undefined });
    await dbRequired(env).prepare(
      "INSERT INTO hostel_edits (name, payload, status, updated_by, updated_at) VALUES (?, ?, ?, 'owner', CURRENT_TIMESTAMP) ON CONFLICT(name) DO UPDATE SET payload=excluded.payload, status=excluded.status, updated_by='owner', updated_at=CURRENT_TIMESTAMP"
    ).bind(name, payload, status).run();
    return reply({ ok: true });
  }

  if (path === "/api/manager/bookings" && request.method === "GET") {
    const result = await dbRequired(env).prepare("SELECT * FROM bookings ORDER BY created_at DESC").all();
    return reply({ bookings: result.results });
  }

  if (path === "/api/manager/bookings" && request.method === "PATCH") {
    const input = await body(request);
    if (!Number(input.id)) return reply({ error: "Booking ID is required" }, 400);
    const allowed = ["pending", "contacted", "confirmed", "cancelled"];
    if (!allowed.includes(input.status)) return reply({ error: "Invalid status" }, 400);
    await dbRequired(env).prepare("UPDATE bookings SET status = ? WHERE id = ?").bind(input.status, Number(input.id)).run();
    return reply({ ok: true });
  }

  return reply({ error: "Not found" }, 404);
}

export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);
      if (url.pathname.startsWith("/api/")) return await api(request, env);
      return env.ASSETS.fetch(request);
    } catch (error) {
      console.error(error);
      return reply({ error: error.message || "Something went wrong" }, 500);
    }
  }
};
