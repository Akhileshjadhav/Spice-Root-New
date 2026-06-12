import { stat, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "../config/env.js";
import { getDeploymentReadiness } from "../config/validateEnv.js";
import { requireUser } from "../middleware/auth.js";
import { ensureAdminProfile } from "../services/authService.js";
import { decrementProductStockForUser } from "../services/inventoryService.js";
import { createRazorpayOrder, verifyRazorpaySignature } from "../services/razorpayService.js";
import { getCorsOrigin, HttpError, matchPattern, readJsonBody, sendJson } from "../utils/http.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const staticDir = path.resolve(__dirname, "../../../client/dist");

const mimeTypes = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".wav": "audio/wav",
  ".mp4": "video/mp4",
  ".woff": "application/font-woff",
  ".ttf": "application/font-ttf",
  ".eot": "application/vnd.ms-fontobject",
  ".otf": "application/font-otf",
  ".wasm": "application/wasm",
  ".ico": "image/x-icon",
};

async function serveStaticFile(urlPath, response) {
  if (urlPath === "/") {
    urlPath = "/index.html";
  }

  let filePath = path.join(staticDir, urlPath);
  
  if (!filePath.startsWith(staticDir)) {
    return false;
  }

  try {
    let fileStat = await stat(filePath);
    if (fileStat.isDirectory()) {
      filePath = path.join(filePath, "index.html");
      fileStat = await stat(filePath);
    }

    const extname = String(path.extname(filePath)).toLowerCase();
    const contentType = mimeTypes[extname] || "application/octet-stream";

    const content = await readFile(filePath);
    response.writeHead(200, { "Content-Type": contentType });
    response.end(content, "utf-8");
    return true;
  } catch (error) {
    if (error.code === "ENOENT" && !urlPath.startsWith("/api/")) {
      try {
        const indexHtml = await readFile(path.join(staticDir, "index.html"));
        response.writeHead(200, { "Content-Type": "text/html" });
        response.end(indexHtml, "utf-8");
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }
}

const routes = [];

function route(method, pattern, handler) {
  routes.push({ method, pattern, handler });
}

function json(payload) {
  return {
    statusCode: 200,
    payload,
  };
}

route("GET", "/health", async () => {
  const readiness = getDeploymentReadiness();

  return json({
    ok: readiness.ready,
    service: "spice-root-server",
    environment: config.nodeEnv,
    backend: "firebase-admin",
    razorpayMode: config.razorpay.mockMode ? "mock-test" : "razorpay-test",
    checks: {
      firebaseAdmin: readiness.firebaseAdminConfigured,
      razorpay: readiness.razorpayConfigured,
      adminAllowlist: readiness.adminAllowlistConfigured,
      clientOrigin: readiness.clientOriginConfigured,
    },
  });
});

route("POST", "/api/auth/ensure-admin", async ({ request }) => {
  const user = await requireUser(request);
  return json({ adminProfile: await ensureAdminProfile(user) });
});

function parsePaymentAmount(value) {
  const amount = Number(value);

  if (!Number.isFinite(amount) || amount <= 0 || amount > 500000) {
    throw new HttpError(400, "Invalid order amount.");
  }

  return amount;
}

function parseOrderDocumentId(value) {
  const orderDocumentId = String(value || "").trim();

  if (!orderDocumentId || orderDocumentId.length > 128 || !/^[A-Za-z0-9_-]+$/.test(orderDocumentId)) {
    throw new HttpError(400, "Invalid order reference.");
  }

  return orderDocumentId;
}

route("POST", "/api/orders/inventory-adjustment", async ({ request, body }) => {
  const user = await requireUser(request);
  return json(await decrementProductStockForUser(user, body.items || []));
});

route("GET", "/api/razorpay/config", async ({ request }) => {
  await requireUser(request);

  if (!config.razorpay.keyId) {
    throw new HttpError(500, "Razorpay key is not configured on the server.");
  }

  return json({
    keyId: config.razorpay.keyId,
    mode: config.razorpay.mockMode ? "mock-test" : "razorpay-test",
  });
});

route("POST", "/api/razorpay/create-order", async ({ request, body }) => {
  const user = await requireUser(request);
  const amount = parsePaymentAmount(body.amount);
  const orderDocumentId = body.orderDocumentId ? parseOrderDocumentId(body.orderDocumentId) : "";
  const order = await createRazorpayOrder({
    amount,
    currency: body.currency || "INR",
    receipt: body.receipt || orderDocumentId || `spice-root-${user.uid}-${Date.now()}`,
    notes: {
      orderDocumentId,
      customerEmail: body.customerEmail || user.email || "",
      userId: user.uid,
      mode: config.razorpay.mockMode ? "mock-test" : "test",
    },
  });

  if (!config.razorpay.keyId) {
    throw new HttpError(500, "Razorpay key is not configured on the server.");
  }

  return json({
    keyId: config.razorpay.keyId,
    razorpayOrderId: order.id,
    amount: order.amount,
    currency: order.currency,
    mock: order.mock,
  });
});

route("POST", "/api/razorpay/verify-payment", async ({ request, body }) => {
  await requireUser(request);

  if (body.localMock && config.nodeEnv === "production") {
    throw new HttpError(400, "Local mock payments are not allowed in production.");
  }

  const verified = verifyRazorpaySignature({
    razorpayOrderId: body.razorpayOrderId,
    paymentId: body.paymentId,
    razorpaySignature: body.razorpaySignature,
  });

  return {
    statusCode: verified ? 200 : 400,
    payload: {
      verified,
      mode: config.razorpay.mockMode ? "mock-test" : "razorpay-test",
      paymentId: body.paymentId || "",
      razorpayOrderId: body.razorpayOrderId || "",
      razorpaySignature: body.razorpaySignature || "",
    },
  };
});

function findRoute(method, pathname) {
  for (const item of routes) {
    if (item.method !== method) {
      continue;
    }

    const params = matchPattern(item.pattern, pathname);

    if (params) {
      return { ...item, params };
    }
  }

  return null;
}

export async function handleRequest(request, response) {
  const origin = getCorsOrigin(request.headers.origin);
  const url = new URL(request.url, `http://${request.headers.host}`);

  if (request.method === "OPTIONS") {
    sendJson(response, 204, {}, origin);
    return;
  }

  try {
    const matchedRoute = findRoute(request.method, url.pathname);

    if (!matchedRoute) {
      if (request.method === "GET") {
        const served = await serveStaticFile(url.pathname, response);
        if (served) {
          return;
        }
      }
      throw new HttpError(404, "Route not found.");
    }

    const body = ["POST", "PATCH", "PUT"].includes(request.method)
      ? await readJsonBody(request)
      : {};
    const result = await matchedRoute.handler({
      request,
      response,
      params: matchedRoute.params,
      query: url.searchParams,
      body,
    });

    sendJson(response, result.statusCode || 200, result.payload ?? result, origin);
  } catch (error) {
    const statusCode = error.statusCode || 500;

    if (statusCode >= 500) {
      console.error(error);
    }

    sendJson(
      response,
      statusCode,
      {
        error: error.message || "Unexpected server error.",
      },
      origin
    );
  }
}
