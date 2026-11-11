const { getEntitlements, hasLocalProAccess, required, supabaseUrl } = require("./_shared");

const LANGUAGE_IDS = Object.freeze({ csharp: 51, python: 71, java: 62 });
const MAX_BODY_BYTES = 64 * 1024;
const MAX_SOURCE_BYTES = 32 * 1024;
const MAX_INPUT_BYTES = 8 * 1024;
const MAX_EXPECTED_BYTES = 8 * 1024;

function sendJson(res, status, body) {
  res.setHeader("Cache-Control", "private, no-store, max-age=0");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  return res.status(status).json(body);
}

function sessionCookie(req) {
  const raw = req.headers.cookie || "";
  const value = raw.split(";").map(item => item.trim())
    .find(item => item.startsWith("visual_pro_session="))
    ?.slice("visual_pro_session=".length);
  if (!value) return null;
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

async function userFromCookie(req) {
  const token = sessionCookie(req);
  if (!token) return null;
  const response = await fetch(supabaseUrl("/auth/v1/user"), {
    headers: {
      apikey: required("SUPABASE_ANON_KEY"),
      Authorization: `Bearer ${token}`,
    },
    signal: AbortSignal.timeout(4000),
  });
  if (!response.ok) return null;
  const user = await response.json();
  return typeof user.id === "string" ? user : null;
}

async function hasProAccess(userId) {
  const entitlements = await getEntitlements(userId);
  return entitlements.some(item => item.tier === "Pro");
}

function judge0BaseUrl() {
  const url = new URL(required("JUDGE0_API_URL"));
  const localHttp = url.protocol === "http:" && ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  if ((url.protocol !== "https:" && !localHttp) || url.username || url.password || url.search || url.hash) {
    throw new Error("JUDGE0_API_URL must be an HTTPS base URL.");
  }
  return url;
}

function providerHeaders() {
  const headers = { "Content-Type": "application/json" };
  if (process.env.JUDGE0_API_TOKEN) headers["X-Auth-Token"] = process.env.JUDGE0_API_TOKEN;
  return headers;
}

async function parseBody(req) {
  if (Number(req.headers["content-length"]) > MAX_BODY_BYTES) {
    return { error: "Request body is too large." };
  }
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) {
    if (Buffer.byteLength(JSON.stringify(req.body)) > MAX_BODY_BYTES) return { error: "Request body is too large." };
    return { body: req.body };
  }
  let raw;
  if (Buffer.isBuffer(req.body)) raw = req.body;
  else if (typeof req.body === "string") raw = Buffer.from(req.body);
  else {
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      chunks.push(buffer);
      size += buffer.length;
      if (size > MAX_BODY_BYTES) {
        return { error: "Request body is too large." };
      }
    }
    raw = Buffer.concat(chunks);
  }
  if (raw.length > MAX_BODY_BYTES) return { error: "Request body is too large." };
  try {
    return { body: JSON.parse(raw.toString("utf8")) };
  } catch {
    return { error: "Request body must be valid JSON." };
  }
}

function boundedText(value, maxBytes) {
  return typeof value === "string" && Buffer.byteLength(value, "utf8") <= maxBytes;
}

function providerError(res, message, status = 502) {
  console.error(`Judge0 ${message}`);
  return sendJson(res, status, { error: message });
}

function mappedResult(submission) {
  const status = submission.status || {};
  const text = value => typeof value === "string" ? value.slice(0, 8000) : "";
  let state = "error";
  if (status.id === 1 || status.id === 2) state = "pending";
  else if (status.id === 3) state = "pass";
  else if (status.id === 4) state = "fail";
  else if (status.id === 5) state = "timed_out";
  else if (status.id === 6) state = "compile_error";
  else if ([7, 8, 9, 10, 11, 12, 14].includes(status.id)) state = "runtime_error";

  return {
    state,
    status: typeof status.description === "string" ? status.description : "Unknown status",
    stdout: text(submission.stdout),
    stderr: text(submission.stderr),
    compileOutput: text(submission.compile_output),
    time: typeof submission.time === "string" ? submission.time : null,
    memory: Number.isFinite(submission.memory) ? submission.memory : null,
  };
}

module.exports = async function handler(req, res) {
  try {
    if (req.method !== "POST" && req.method !== "GET") {
      res.setHeader("Allow", "GET, POST");
      return sendJson(res, 405, { error: "Method not allowed." });
    }

    const localPro = hasLocalProAccess(req);
    const user = await userFromCookie(req);
    if (!user && !localPro) return sendJson(res, 401, { error: "Sign in again to run code." });
    if (!localPro && !await hasProAccess(user.id)) return sendJson(res, 403, { error: "Pro access is required to run code." });

    const baseUrl = judge0BaseUrl();
    const headers = providerHeaders();
    if (req.method === "POST") {
      const parsed = await parseBody(req);
      if (parsed.error) return sendJson(res, 400, { error: parsed.error });
      const { language, sourceCode, stdin, expectedOutput } = parsed.body || {};
      if (!Object.hasOwn(LANGUAGE_IDS, language)) return sendJson(res, 400, { error: "Choose C#, Python, or Java." });
      if (!boundedText(sourceCode, MAX_SOURCE_BYTES) || !sourceCode.trim()) {
        return sendJson(res, 400, { error: "Source code is required and must be 32 KB or smaller." });
      }
      if (!boundedText(stdin, MAX_INPUT_BYTES)) return sendJson(res, 400, { error: "Input must be text no larger than 8 KB." });
      if (!boundedText(expectedOutput, MAX_EXPECTED_BYTES)) {
        return sendJson(res, 400, { error: "Expected output must be text no larger than 8 KB." });
      }

      const providerResponse = await fetch(new URL("/submissions?base64_encoded=false&wait=false", baseUrl), {
        method: "POST",
        headers,
        body: JSON.stringify({
          source_code: sourceCode,
          language_id: LANGUAGE_IDS[language],
          stdin,
          expected_output: expectedOutput,
          cpu_time_limit: 2,
          wall_time_limit: 5,
          memory_limit: 128000,
          max_file_size: 1024,
          enable_network: false,
        }),
        signal: AbortSignal.timeout(6000),
      });
      if (!providerResponse.ok) return providerError(res, "could not accept this submission.");
      const submission = await providerResponse.json();
      if (typeof submission.token !== "string" || !/^[\w.-]{1,256}$/.test(submission.token)) {
        return providerError(res, "returned an invalid submission token.");
      }
      return sendJson(res, 202, { state: "pending", token: submission.token });
    }

    const token = typeof req.query?.token === "string" ? req.query.token : "";
    if (!/^[\w.-]{1,256}$/.test(token)) return sendJson(res, 400, { error: "A valid submission token is required." });
    const providerResponse = await fetch(new URL(`/submissions/${encodeURIComponent(token)}?base64_encoded=false`, baseUrl), {
      headers,
      signal: AbortSignal.timeout(6000),
    });
    if (!providerResponse.ok) return providerError(res, "could not retrieve this result.");
    return sendJson(res, 200, mappedResult(await providerResponse.json()));
  } catch (error) {
    if (error?.name === "TimeoutError" || error?.name === "AbortError") {
      return sendJson(res, 504, { error: "Compiler service timed out. Please try again." });
    }
    console.error("Compiler request failed.", error?.message || "Unexpected error");
    const status = String(error?.message || "").startsWith("Missing required server configuration:") ||
      String(error?.message || "").startsWith("JUDGE0_API_URL") ? 503 : 500;
    return sendJson(res, status, {
      error: status === 503 ? "The compiler service is not configured." : "Compiler request could not be completed.",
    });
  }
};
