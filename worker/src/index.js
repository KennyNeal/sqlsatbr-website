const ALLOWED_ORIGINS = new Set([
  "https://www.dayofdatabr.org",
  "https://dayofdatabr.org",
  "http://localhost:1313",
]);

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(request),
      });
    }

    if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/health")) {
      return json(
        {
          ok: true,
          service: "sponsor-intake-worker",
          route: "/api/invoice-request",
        },
        200,
        request,
      );
    }

    if (request.method === "POST" && url.pathname === "/api/invoice-request") {
      return handleInvoiceRequest(request, env);
    }

    return json(
      {
        ok: false,
        message: "Not found.",
      },
      404,
      request,
    );
  },
};

async function handleInvoiceRequest(request, env) {
  let payload;

  try {
    payload = await parsePayload(request);
  } catch {
    return respondForRequest(
      request,
      {
        ok: false,
        message: "The invoice request payload could not be read.",
      },
      400,
    );
  }

  const submission = normalizePayload(payload);
  const errors = validateSubmission(submission);

  if (errors.length > 0) {
    return respondForRequest(
      request,
      {
        ok: false,
        message: "Please correct the highlighted invoice request fields.",
        errors,
      },
      400,
    );
  }

  if (!env.SPONSOR_INTAKE_WEBHOOK_URL) {
    return respondForRequest(
      request,
      {
        ok: false,
        message: "The invoice request service is not fully configured yet.",
      },
      500,
    );
  }

  const forwardPayload = {
    event: "invoice-request.created",
    submittedAt: new Date().toISOString(),
    source: "dayofdatabr.org",
    submission,
  };

  const headers = {
    "Content-Type": "application/json",
    "User-Agent": "sqlsatbr-worker",
  };

  if (env.SPONSOR_INTAKE_SHARED_SECRET) {
    headers["X-Sponsor-Intake-Secret"] = env.SPONSOR_INTAKE_SHARED_SECRET;
  }

  const webhookResponse = await fetch(env.SPONSOR_INTAKE_WEBHOOK_URL, {
    method: "POST",
    headers,
    body: JSON.stringify(forwardPayload),
  });

  if (!webhookResponse.ok) {
    return respondForRequest(
      request,
      {
        ok: false,
        message: "The invoice request could not be recorded right now.",
      },
      502,
    );
  }

  return respondForRequest(
    request,
    {
      ok: true,
      message: "Thanks. Your invoice request was received and an organizer will follow up.",
    },
    200,
  );
}

async function parsePayload(request) {
  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return request.json();
  }

  if (
    contentType.includes("application/x-www-form-urlencoded") ||
    contentType.includes("multipart/form-data")
  ) {
    const formData = await request.formData();
    return Object.fromEntries(formData.entries());
  }

  return {};
}

function normalizePayload(payload) {
  return {
    organizationName: normalizeText(payload.organizationName),
    primaryContactName: normalizeText(payload.primaryContactName),
    contactEmail: normalizeEmail(payload.contactEmail),
    contactPhone: normalizeText(payload.contactPhone),
    sponsorPackage: normalizeText(payload.sponsorPackage),
    billingContactEmail: normalizeEmail(payload.billingContactEmail),
    preferredPaymentMethod: normalizeText(payload.preferredPaymentMethod),
    notes: normalizeText(payload.notes),
    companyWebsite: normalizeText(payload.companyWebsite),
  };
}

function validateSubmission(submission) {
  const errors = [];

  if (!submission.organizationName) errors.push("organizationName");
  if (!submission.primaryContactName) errors.push("primaryContactName");
  if (!looksLikeEmail(submission.contactEmail)) errors.push("contactEmail");
  if (!submission.contactPhone) errors.push("contactPhone");
  if (!submission.sponsorPackage) errors.push("sponsorPackage");
  if (!looksLikeEmail(submission.billingContactEmail)) errors.push("billingContactEmail");
  if (!submission.preferredPaymentMethod) errors.push("preferredPaymentMethod");
  if (submission.companyWebsite) errors.push("companyWebsite");

  return errors;
}

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeEmail(value) {
  return normalizeText(value).toLowerCase();
}

function looksLikeEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function respondForRequest(request, body, status) {
  const accept = request.headers.get("accept") || "";

  if (accept.includes("text/html") && !accept.includes("application/json")) {
    return html(body, status, request);
  }

  return json(body, status, request);
}

function json(body, status, request) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders(request),
    },
  });
}

function html(body, status, request) {
  const color = body.ok ? "#1a7f37" : "#b42318";
  const markup = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Invoice Request</title>
  </head>
  <body style="font-family: Segoe UI, Tahoma, sans-serif; padding: 2rem; line-height: 1.5;">
    <h1 style="margin-top: 0;">Day of Data Baton Rouge</h1>
    <p style="color: ${color}; font-weight: 600;">${escapeHtml(body.message)}</p>
    <p><a href="https://www.dayofdatabr.org/invoice-request">Return to the invoice request page</a></p>
  </body>
</html>`;

  return new Response(markup, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      ...corsHeaders(request),
    },
  });
}

function corsHeaders(request) {
  const origin = request.headers.get("origin");
  const headers = {
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Accept",
  };

  if (origin && ALLOWED_ORIGINS.has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Vary"] = "Origin";
  }

  return headers;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
