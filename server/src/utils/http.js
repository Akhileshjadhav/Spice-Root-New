import { config } from "../config/env.js";

const DEFAULT_CLIENT_ORIGIN = "http://localhost:5173";
const DEV_CLIENT_PORTS = new Set(["5173", "4173", "3000"]);

export class HttpError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

export function getCorsOrigin(requestOrigin) {
  if (!requestOrigin) {
    return config.clientOrigins[0] || DEFAULT_CLIENT_ORIGIN;
  }

  if (config.clientOrigins.includes("*") || config.clientOrigins.includes(requestOrigin)) {
    return requestOrigin;
  }

  if (config.nodeEnv !== "production" && isPrivateDevOrigin(requestOrigin)) {
    return requestOrigin;
  }

  return config.clientOrigins[0] || DEFAULT_CLIENT_ORIGIN;
}

function isPrivateDevOrigin(origin) {
  try {
    const url = new URL(origin);
    const hostname = url.hostname;

    if (!["http:", "https:"].includes(url.protocol)) {
      return false;
    }

    if (!DEV_CLIENT_PORTS.has(url.port)) {
      return false;
    }

    return (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1" ||
      hostname.startsWith("10.") ||
      hostname.startsWith("192.168.") ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname)
    );
  } catch {
    return false;
  }
}

export function sendJson(response, statusCode, payload, origin = DEFAULT_CLIENT_ORIGIN) {
  response.writeHead(statusCode, {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Private-Network": "true",
    "Content-Type": "application/json",
    Vary: "Origin",
  });
  response.end(JSON.stringify(payload));
}

export function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";

    request.on("data", (chunk) => {
      body += chunk;

      if (body.length > 1_000_000) {
        request.destroy();
        reject(new HttpError(413, "Request body is too large."));
      }
    });

    request.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new HttpError(400, "Invalid JSON body."));
      }
    });

    request.on("error", reject);
  });
}

export function routeKey(method, pathname) {
  return `${method.toUpperCase()} ${pathname}`;
}

export function matchPattern(pattern, pathname) {
  const patternParts = pattern.split("/").filter(Boolean);
  const pathParts = pathname.split("/").filter(Boolean);

  if (patternParts.length !== pathParts.length) {
    return null;
  }

  const params = {};

  for (let index = 0; index < patternParts.length; index += 1) {
    const patternPart = patternParts[index];
    const pathPart = pathParts[index];

    if (patternPart.startsWith(":")) {
      params[patternPart.slice(1)] = decodeURIComponent(pathPart);
      continue;
    }

    if (patternPart !== pathPart) {
      return null;
    }
  }

  return params;
}
