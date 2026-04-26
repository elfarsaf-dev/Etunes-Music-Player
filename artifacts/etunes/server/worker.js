/**
 * etunes Cloudflare Worker
 * ===============================================================
 * Endpoints:
 *   POST /register          { username, password }
 *   POST /login             { username, password }  ATAU
 *                           { username, api_key }   ATAU
 *                           { api_key }              (key aja)
 *   GET  /me                (x-api-key header)
 *   GET  /usage             (x-api-key)
 *   GET  /search?q=...      (x-api-key)
 *   POST /download          (x-api-key) { url }
 *   POST /regenerate-key    (x-api-key)
 *   POST /update-username   (x-api-key) { username }
 *   POST /update-password   (x-api-key) { password }
 *
 * ===============================================================
 * SCHEMA SUPABASE
 * Tambah kolom & tabel berikut sebelum deploy:
 *
 *   ALTER TABLE mc_profiles ADD COLUMN username TEXT UNIQUE;
 *   ALTER TABLE mc_profiles ADD COLUMN email TEXT;
 *   ALTER TABLE mc_profiles ADD COLUMN signup_ip TEXT;
 *   ALTER TABLE mc_profiles ADD COLUMN last_login_ip TEXT;
 *   ALTER TABLE mc_profiles ADD COLUMN last_login_at TIMESTAMPTZ;
 *   CREATE INDEX IF NOT EXISTS idx_mc_profiles_username ON mc_profiles(username);
 *   CREATE INDEX IF NOT EXISTS idx_mc_profiles_signup_ip ON mc_profiles(signup_ip);
 *
 *   -- Tabel blocklist IP. Hapus baris kalau mau unblock.
 *   CREATE TABLE IF NOT EXISTS mc_blocked_ips (
 *     ip TEXT PRIMARY KEY,
 *     reason TEXT,
 *     blocked_at TIMESTAMPTZ DEFAULT now()
 *   );
 *
 * Untuk akun lama (yang belum punya username), bisa di-backfill manual,
 * atau biarkan login pakai api_key aja (tetap jalan tanpa username).
 * ===============================================================
 */

// Maks akun yang boleh dibuat dari 1 IP. Naikan kalau perlu.
const MAX_ACCOUNTS_PER_IP = 3

// ============================
// RATE LIMIT MEMORY
// ============================
const rateLimitMap = new Map()

function checkRateLimit(ip, max = 10, windowMs = 60000) {
  const now = Date.now()
  if (!rateLimitMap.has(ip)) {
    rateLimitMap.set(ip, { count: 1, time: now })
    return true
  }
  const data = rateLimitMap.get(ip)
  if (now - data.time > windowMs) {
    rateLimitMap.set(ip, { count: 1, time: now })
    return true
  }
  if (data.count >= max) return false
  data.count++
  return true
}

// ============================
// CORS
// ============================
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-api-key"
}

export default {
  async fetch(req) {
    const url = new URL(req.url)

    const SUPABASE_URL = "https://bgwkwlrkvbspycqsdeif.supabase.co"
    const SERVICE_KEY = "xxxxxxxx" // ganti dengan service key

    const sb = (path, init = {}) =>
      fetch(`${SUPABASE_URL}${path}`, {
        ...init,
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
          ...(init.headers || {})
        }
      })

    // ============================
    // CORS PRE-FLIGHT
    // ============================
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders })
    }

    const ip = req.headers.get("CF-Connecting-IP") || "unknown"

    // ============================
    // RATE LIMIT untuk endpoint sensitif
    // ============================
    if (
      url.pathname === "/register" ||
      url.pathname === "/login"
    ) {
      if (!checkRateLimit(ip)) {
        return json(
          { error: "Terlalu banyak request, coba lagi 1 menit lagi" },
          429
        )
      }
    }

    // ============================
    // REGISTER  { username, password }
    // ============================
    if (url.pathname === "/register" && req.method === "POST") {
      const body = await req.json().catch(() => ({}))
      const username = (body.username || "").trim()
      const password = body.password || ""

      if (!username || !password) {
        return json({ error: "Username & password wajib" }, 400)
      }

      // ---- IP block check ----
      if (await isBlockedIp(sb, ip)) {
        return json(
          { error: "IP kamu diblokir karena penyalahgunaan." },
          403
        )
      }

      // ---- IP account-cap check ----
      const ipCount = await countAccountsByIp(sb, ip)
      if (ipCount >= MAX_ACCOUNTS_PER_IP) {
        return json(
          {
            error: `Sudah ada ${ipCount} akun dari jaringan ini. Maksimal ${MAX_ACCOUNTS_PER_IP} akun per IP.`
          },
          429
        )
      }

      // cek username unik
      const dup = await sb(
        `/rest/v1/mc_profiles?username=eq.${encodeURIComponent(username)}&select=id`
      )
      const dupRows = await dup.json().catch(() => [])
      if (Array.isArray(dupRows) && dupRows.length > 0) {
        return json({ error: "Username sudah dipakai" }, 409)
      }

      // bikin email internal supaya kompatibel dgn Supabase Auth
      const email = `${slug(username)}.${randomShort()}@etunes.app`

      const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: SERVICE_KEY },
        body: JSON.stringify({ email, password })
      })
      const data = await res.json().catch(() => ({}))
      if (!data.user) {
        return json(
          { error: data?.msg || data?.error_description || "Gagal register" },
          500
        )
      }

      const userId = data.user.id
      const apiKey = generateApiKey()
      const nowIso = new Date().toISOString()

      await sb(`/rest/v1/mc_profiles`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: userId,
          api_key: apiKey,
          username,
          email,
          is_premium: false,
          signup_ip: ip,
          last_login_ip: ip,
          last_login_at: nowIso
        })
      })

      return json({
        message: "Register berhasil",
        api_key: apiKey,
        username,
        id: userId,
        is_premium: false
      })
    }

    // ============================
    // LOGIN
    //   { username, password }
    //   { username, api_key }
    //   { api_key }   (key aja, tanpa username)
    // ============================
    if (url.pathname === "/login" && req.method === "POST") {
      const body = await req.json().catch(() => ({}))
      const username = (body.username || "").trim()
      const password = body.password || ""
      const providedKey = (body.api_key || "").trim()

      if (await isBlockedIp(sb, ip)) {
        return json(
          { error: "IP kamu diblokir karena penyalahgunaan." },
          403
        )
      }

      // ---- Path A: key aja, tanpa username ----
      if (!username && providedKey) {
        const r = await sb(
          `/rest/v1/mc_profiles?api_key=eq.${encodeURIComponent(providedKey)}&select=*`
        )
        const rows = await r.json().catch(() => [])
        const profile = Array.isArray(rows) ? rows[0] : null
        if (!profile) return json({ error: "API key tidak valid" }, 401)
        await recordLogin(sb, profile.id, ip)
        return json(stripProfile(profile))
      }

      if (!username) {
        return json({ error: "Username wajib" }, 400)
      }

      // lookup by username
      const r = await sb(
        `/rest/v1/mc_profiles?username=eq.${encodeURIComponent(username)}&select=*`
      )
      const rows = await r.json().catch(() => [])
      const profile = Array.isArray(rows) ? rows[0] : null
      if (!profile) return json({ error: "Akun tidak ditemukan" }, 404)

      // ---- Path B: username + key ----
      if (providedKey) {
        if (profile.api_key !== providedKey) {
          return json({ error: "API key salah" }, 401)
        }
        await recordLogin(sb, profile.id, ip)
        return json(stripProfile(profile))
      }

      // ---- Path C: username + password ----
      if (password) {
        if (!profile.email) {
          return json(
            {
              error:
                "Akun ini belum bisa login pakai password (data lama). Pakai API key dulu."
            },
            400
          )
        }
        const tokenRes = await fetch(
          `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json", apikey: SERVICE_KEY },
            body: JSON.stringify({ email: profile.email, password })
          }
        )
        if (!tokenRes.ok) {
          return json({ error: "Password salah" }, 401)
        }
        await recordLogin(sb, profile.id, ip)
        return json(stripProfile(profile))
      }

      return json({ error: "Password atau API key wajib" }, 400)
    }

    // ============================
    // AUTH x-api-key
    // ============================
    const apiKey = req.headers.get("x-api-key")
    if (!apiKey) return json({ error: "No API key" }, 401)

    const userRes = await sb(
      `/rest/v1/mc_profiles?api_key=eq.${encodeURIComponent(apiKey)}&select=*`
    )
    const profile = (await userRes.json().catch(() => []))[0]
    if (!profile) return json({ error: "Invalid API key" }, 401)
    const userId = profile.id

    // ============================
    // /me
    // ============================
    if (url.pathname === "/me") {
      return json(stripProfile(profile))
    }

    // ============================
    // /usage
    // ============================
    if (url.pathname === "/usage") {
      const today = new Date().toISOString().slice(0, 10)
      const res = await sb(
        `/rest/v1/mc_usage?user_id=eq.${userId}&date=eq.${today}`
      )
      const usage = (await res.json().catch(() => []))[0]
      return json({ today: usage?.play_count || 0, limit: 15 })
    }

    // ============================
    // /search
    // ============================
    if (url.pathname === "/search" && req.method === "GET") {
      const q = url.searchParams.get("q")
      if (!q) return json({ error: "query kosong" }, 400)
      const res = await fetch(
        `https://spotify.elfar.my.id/api/spotify?q=${encodeURIComponent(q)}`
      )
      const data = await res.json().catch(() => ({}))
      return json(data)
    }

    // ============================
    // /download
    // ============================
    if (url.pathname === "/download" && req.method === "POST") {
      const { url: songUrl } = await req.json().catch(() => ({}))
      if (!songUrl) return json({ error: "URL kosong" }, 400)

      const today = new Date().toISOString().slice(0, 10)

      if (!profile.is_premium) {
        const usageRes = await sb(
          `/rest/v1/mc_usage?user_id=eq.${userId}&date=eq.${today}`
        )
        const usage = (await usageRes.json().catch(() => []))[0]

        if (!usage) {
          await sb(`/rest/v1/mc_usage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              user_id: userId,
              date: today,
              play_count: 1
            })
          })
        } else {
          if (usage.play_count >= 15) {
            return json({ error: "Limit harian habis" }, 403)
          }
          await sb(`/rest/v1/mc_usage?id=eq.${usage.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ play_count: usage.play_count + 1 })
          })
        }
      }

      const res = await fetch(
        `https://spotify.elfar.my.id/api/spotify?link=${encodeURIComponent(songUrl)}`
      )
      const data = await res.json().catch(() => ({}))

      return json({
        title: data.data?.title,
        artist: data.data?.artist,
        thumbnail: data.data?.thumbnail,
        download: data.download
      })
    }

    // ============================
    // /regenerate-key
    // ============================
    if (url.pathname === "/regenerate-key" && req.method === "POST") {
      const newKey = generateApiKey()
      await sb(`/rest/v1/mc_profiles?id=eq.${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: newKey })
      })
      return json({ api_key: newKey })
    }

    // ============================
    // /update-username   { username }
    // ============================
    if (url.pathname === "/update-username" && req.method === "POST") {
      const { username: rawNew } = await req.json().catch(() => ({}))
      const newUsername = (rawNew || "").trim()
      if (!newUsername) return json({ error: "Username wajib" }, 400)
      if (newUsername === profile.username) {
        return json({ username: newUsername })
      }

      // unik check
      const dup = await sb(
        `/rest/v1/mc_profiles?username=eq.${encodeURIComponent(newUsername)}&id=neq.${userId}&select=id`
      )
      const dupRows = await dup.json().catch(() => [])
      if (Array.isArray(dupRows) && dupRows.length > 0) {
        return json({ error: "Username sudah dipakai" }, 409)
      }

      const res = await sb(`/rest/v1/mc_profiles?id=eq.${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: newUsername })
      })
      if (!res.ok) return json({ error: "Gagal update username" }, 500)
      return json({ username: newUsername })
    }

    // ============================
    // /update-password   { password }
    // ============================
    if (url.pathname === "/update-password" && req.method === "POST") {
      const { password: newPassword } = await req.json().catch(() => ({}))
      if (!newPassword) return json({ error: "Password wajib" }, 400)

      // kalau profil belum punya email (akun lama), kita assign email
      // baru pakai username supaya akun bisa dipakai login pakai password
      let emailToUse = profile.email
      if (!emailToUse) {
        emailToUse = `${slug(profile.username || "user")}.${randomShort()}@etunes.app`
        await sb(`/rest/v1/mc_profiles?id=eq.${userId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: emailToUse })
        })
      }

      const res = await fetch(
        `${SUPABASE_URL}/auth/v1/admin/users/${userId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            apikey: SERVICE_KEY,
            Authorization: `Bearer ${SERVICE_KEY}`
          },
          body: JSON.stringify({ password: newPassword, email: emailToUse })
        }
      )
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        return json(
          { error: err?.msg || err?.error_description || "Gagal update password" },
          500
        )
      }
      return json({ message: "Password berhasil diupdate" })
    }

    return json({ error: "Not found" }, 404)
  }
}

// ============================
// HELPERS
// ============================

/**
 * True kalau IP ada di tabel mc_blocked_ips.
 * Aman kalau tabel belum dibuat — anggap tidak diblokir.
 */
async function isBlockedIp(sb, ip) {
  if (!ip || ip === "unknown") return false
  try {
    const r = await sb(
      `/rest/v1/mc_blocked_ips?ip=eq.${encodeURIComponent(ip)}&select=ip&limit=1`
    )
    if (!r.ok) return false
    const rows = await r.json().catch(() => [])
    return Array.isArray(rows) && rows.length > 0
  } catch {
    return false
  }
}

/**
 * Hitung berapa akun di mc_profiles yang signup dari IP ini.
 * Pakai header Prefer: count=exact untuk efisiensi.
 */
async function countAccountsByIp(sb, ip) {
  if (!ip || ip === "unknown") return 0
  try {
    const r = await sb(
      `/rest/v1/mc_profiles?signup_ip=eq.${encodeURIComponent(ip)}&select=id`,
      { headers: { Prefer: "count=exact" } }
    )
    const range = r.headers.get("content-range") || ""
    // format: "0-0/N" atau "*/N"
    const m = range.match(/\/(\d+)$/)
    if (m) return Number(m[1])
    const rows = await r.json().catch(() => [])
    return Array.isArray(rows) ? rows.length : 0
  } catch {
    return 0
  }
}

/** Catat last_login_ip & last_login_at di profil. Best-effort. */
async function recordLogin(sb, userId, ip) {
  try {
    await sb(`/rest/v1/mc_profiles?id=eq.${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        last_login_ip: ip || null,
        last_login_at: new Date().toISOString()
      })
    })
  } catch {
    // diam aja, jangan ganggu login
  }
}

function stripProfile(p) {
  return {
    id: p.id,
    username: p.username,
    api_key: p.api_key,
    is_premium: !!p.is_premium
  }
}

function slug(s) {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 24) || "user"
}

function randomShort() {
  return Math.random().toString(36).slice(2, 8)
}

function generateApiKey() {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789"
  function part(len) {
    let s = ""
    for (let i = 0; i < len; i++) {
      s += chars[Math.floor(Math.random() * chars.length)]
    }
    return s
  }
  return `${part(4)}-${part(4)}-${part(4)}-${part(4)}`
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders }
  })
}
