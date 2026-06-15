const ALLOWED_ORIGINS = new Set([
  "https://www.dayofdatabr.org",
  "https://dayofdatabr.org",
  "http://localhost:1313",
]);

const PACKAGE_PRICING = {
  Blog: "50.00",
  Bronze: "250.00",
  Silver: "600.00",
  Gold: "1500.00",
  "Unattended Booth": "1750.00",
  Platinum: "2500.00",
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(request),
      });
    }

    if (request.method === "GET" && url.pathname === "/") {
      return json(
        {
          ok: true,
          service: "sponsor-intake-worker",
          route: "/api/invoice-request",
          provider: "paypal",
        },
        200,
        request,
      );
    }

    if (request.method === "GET" && url.pathname === "/health") {
      return handleHealthCheck(request, env);
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

async function handleHealthCheck(request, env) {
  const config = validatePayPalConfig(env);

  if (!config.ok) {
    return json(
      {
        ok: false,
        provider: "paypal",
        configured: false,
        message: config.message,
      },
      500,
      request,
    );
  }

  try {
    await getPayPalAccessToken(env);

    return json(
      {
        ok: true,
        provider: "paypal",
        configured: true,
        route: "/api/invoice-request",
      },
      200,
      request,
    );
  } catch (error) {
    return json(
      {
        ok: false,
        provider: "paypal",
        configured: false,
        message: error.message,
      },
      502,
      request,
    );
  }
}

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

  const config = validatePayPalConfig(env);
  if (!config.ok) {
    return respondForRequest(
      request,
      {
        ok: false,
        message: config.message,
      },
      500,
    );
  }

  const packageAmount = PACKAGE_PRICING[submission.sponsorPackage];
  if (!packageAmount) {
    return respondForRequest(
      request,
      {
        ok: false,
        message:
          "Automated PayPal invoices currently support the published sponsor packages only. Please contact the organizers for custom invoice requests.",
      },
      400,
    );
  }

  try {
    const accessToken = await getPayPalAccessToken(env);
    const invoice = await createPayPalInvoice(submission, packageAmount, accessToken, env);
    await sendPayPalInvoice(invoice.id, accessToken, env);

    return respondForRequest(
      request,
      {
        ok: true,
        invoiceId: invoice.id,
        message:
          "Thanks. Your PayPal invoice was created and sent, and an organizer will follow up if anything else is needed.",
      },
      200,
    );
  } catch (error) {
    return respondForRequest(
      request,
      {
        ok: false,
        message: error.message || "The PayPal invoice could not be created right now.",
      },
      502,
    );
  }
}

async function getPayPalAccessToken(env) {
  const auth = btoa(`${env.PAYPAL_CLIENT_ID}:${env.PAYPAL_CLIENT_SECRET}`);
  const response = await fetch(`${payPalBaseUrl(env)}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: "grant_type=client_credentials",
  });

  const body = await response.json();
  if (!response.ok || !body.access_token) {
    throw new Error("PayPal authentication failed. Check the Worker PayPal secrets.");
  }

  return body.access_token;
}

async function createPayPalInvoice(submission, packageAmount, accessToken, env) {
  const contactName = splitName(submission.primaryContactName);
  const invoiceDate = new Date().toISOString().slice(0, 10);

  const payload = {
    detail: {
      currency_code: "USD",
      invoice_date: invoiceDate,
      reference: buildReference(submission),
      note: buildInvoiceNote(submission),
      term: "Due on receipt",
      memo: `Day of Data Baton Rouge 2026 ${submission.sponsorPackage} sponsor invoice`,
    },
    primary_recipients: [
      {
        billing_info: {
          name: {
            given_name: contactName.givenName,
            surname: contactName.surname,
          },
          email_address: submission.billingContactEmail,
        },
      },
    ],
    items: [
      {
        name: `Day of Data Baton Rouge 2026 ${submission.sponsorPackage} Sponsorship`,
        description: buildInvoiceLineDescription(submission),
        quantity: "1",
        unit_amount: {
          currency_code: "USD",
          value: packageAmount,
        },
      },
    ],
  };

  if (env.PAYPAL_INVOICER_EMAIL) {
    payload.invoicer = {
      email_address: env.PAYPAL_INVOICER_EMAIL,
    };
  }

  const response = await fetch(`${payPalBaseUrl(env)}/v2/invoicing/invoices`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  const body = await response.json();
  if (!response.ok || !body.id) {
    throw new Error(extractPayPalError(body, "PayPal could not create the invoice."));
  }

  return body;
}

async function sendPayPalInvoice(invoiceId, accessToken, env) {
  const response = await fetch(
    `${payPalBaseUrl(env)}/v2/invoicing/invoices/${invoiceId}/send`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({}),
    },
  );

  if (response.status === 202 || response.status === 200) {
    return;
  }

  const body = await response.json().catch(() => null);
  throw new Error(
    extractPayPalError(body, "PayPal created the invoice, but it could not be sent."),
  );
}

function validatePayPalConfig(env) {
  if (!env.PAYPAL_CLIENT_ID || !env.PAYPAL_CLIENT_SECRET) {
    return {
      ok: false,
      message: "The PayPal invoice service is not fully configured yet.",
    };
  }

  const configuredEnv = normalizeText(env.PAYPAL_ENV).toLowerCase();
  if (configuredEnv !== "sandbox" && configuredEnv !== "live") {
    return {
      ok: false,
      message: "PAYPAL_ENV must be set to sandbox or live.",
    };
  }

  return { ok: true };
}

function payPalBaseUrl(env) {
  return normalizeText(env.PAYPAL_ENV).toLowerCase() === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
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

function splitName(fullName) {
  const parts = normalizeText(fullName).split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return { givenName: "Sponsor", surname: "Contact" };
  }

  if (parts.length === 1) {
    return { givenName: parts[0], surname: "Contact" };
  }

  return {
    givenName: parts[0],
    surname: parts.slice(1).join(" "),
  };
}

function buildReference(submission) {
  const stamp = new Date().toISOString().replaceAll(/[-:TZ.]/g, "").slice(0, 12);
  return `DODBR-${submission.sponsorPackage.toUpperCase().replaceAll(/\s+/g, "-")}-${stamp}`;
}

function buildInvoiceLineDescription(submission) {
  return [
    `Organization: ${submission.organizationName}`,
    `Primary contact: ${submission.primaryContactName}`,
    `Contact email: ${submission.contactEmail}`,
    `Contact phone: ${submission.contactPhone}`,
    `Preferred payment method: ${submission.preferredPaymentMethod}`,
  ].join(" | ");
}

function buildInvoiceNote(submission) {
  const lines = [
    `Sponsor organization: ${submission.organizationName}`,
    `Primary contact: ${submission.primaryContactName}`,
    `Contact email: ${submission.contactEmail}`,
    `Contact phone: ${submission.contactPhone}`,
    `Billing email: ${submission.billingContactEmail}`,
    `Preferred payment method: ${submission.preferredPaymentMethod}`,
  ];

  if (submission.notes) {
    lines.push(`Notes: ${submission.notes}`);
  }

  return lines.join("\n");
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

function extractPayPalError(body, fallbackMessage) {
  if (!body || typeof body !== "object") {
    return fallbackMessage;
  }

  const issue = Array.isArray(body.details) && body.details.length > 0 ? body.details[0].issue : "";
  const description =
    Array.isArray(body.details) && body.details.length > 0 ? body.details[0].description : "";
  const message = normalizeText(body.message);
  const debugId = normalizeText(body.debug_id);

  const parts = [fallbackMessage];

  if (message) {
    parts.push(message);
  }

  if (issue) {
    parts.push(`Issue: ${issue}`);
  }

  if (description) {
    parts.push(description);
  }

  if (debugId) {
    parts.push(`PayPal debug_id: ${debugId}`);
  }

  return parts.join(" ");
}
