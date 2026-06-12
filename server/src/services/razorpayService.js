import crypto from "node:crypto";
import { config } from "../config/env.js";

function assertRazorpayTestMode() {
  if (!config.razorpay.keyId || !config.razorpay.keySecret) {
    throw new Error("Razorpay keys are not configured on the server.");
  }

  if (!config.razorpay.allowLive && !config.razorpay.keyId.startsWith("rzp_test_")) {
    throw new Error("Only Razorpay test keys are allowed unless ALLOW_LIVE_RAZORPAY=true.");
  }
}

export async function createRazorpayOrder({ amount, currency = "INR", receipt, notes = {} }) {
  const amountInPaise = Math.max(1, Math.round(Number(amount || 0) * 100));

  if (config.razorpay.mockMode) {
    return {
      id: "",
      amount: amountInPaise,
      currency,
      receipt,
      notes,
      mock: true,
    };
  }

  assertRazorpayTestMode();

  const credentials = Buffer.from(`${config.razorpay.keyId}:${config.razorpay.keySecret}`).toString("base64");
  const razorpayResponse = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: amountInPaise,
      currency,
      receipt,
      notes,
    }),
  });

  const payload = await razorpayResponse.json();

  if (!razorpayResponse.ok) {
    throw new Error(payload?.error?.description || "Failed to create Razorpay order.");
  }

  return {
    ...payload,
    mock: false,
  };
}

export function verifyRazorpaySignature({ razorpayOrderId, paymentId, razorpaySignature }) {
  if (config.razorpay.mockMode && (!razorpayOrderId || !razorpaySignature)) {
    return true;
  }

  assertRazorpayTestMode();

  if (!razorpayOrderId || !paymentId || !razorpaySignature) {
    return false;
  }

  const expectedSignature = crypto
    .createHmac("sha256", config.razorpay.keySecret)
    .update(`${razorpayOrderId}|${paymentId}`)
    .digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(expectedSignature),
    Buffer.from(String(razorpaySignature))
  );
}
