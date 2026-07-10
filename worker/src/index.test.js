import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parse as parseYaml } from "yaml";
import {
  buildPayPalPayload,
  validateSubmission,
  buildGitHubIssueBody,
  priceFor,
  PRICING_TABLE,
} from "./index.js";

const baseSubmission = {
  eventName: "Test Event 2027",
  eventSlug: "test-event-2027",
  organizationName: "Acme Corp",
  primaryContactName: "Jane Doe",
  contactEmail: "jane@acme.com",
  contactPhone: "555-1234",
  sponsorPackage: "Bronze",
  billingContactEmail: "ap@acme.com",
  sponsorWebsite: "https://acme.com",
  logoUrl: "",
  notes: "",
  companyWebsite: "",
};

describe("buildPayPalPayload", () => {
  it("uses eventName in memo and line-item name", () => {
    const payload = buildPayPalPayload(baseSubmission, "250.00");

    expect(payload.detail.memo).toBe("Test Event 2027 Bronze sponsor invoice");
    expect(payload.items[0].name).toBe("Test Event 2027 Bronze Sponsorship");
  });

  it("uses packageAmount as unit_amount value", () => {
    const payload = buildPayPalPayload(baseSubmission, "250.00");

    expect(payload.items[0].unit_amount.value).toBe("250.00");
  });
});

describe("buildGitHubIssueBody", () => {
  it("includes structured fields parseable by intake-sponsor workflow", () => {
    const body = buildGitHubIssueBody(
      { ...baseSubmission, eventSlug: "test-event-2027", sponsorPackage: "Bronze" },
      "DODBR-BRONZE-20270101120000",
      "250.00",
    );

    expect(body).toContain("### Sponsor Tier\nBronze");
    expect(body).toContain("### Event\ntest-event-2027");
    expect(body).toContain("### Sponsor Name\nAcme Corp");
    expect(body).toContain("### Sponsor Website URL\nhttps://acme.com");
  });

  it("uses _No response_ placeholder when logoUrl is empty", () => {
    const body = buildGitHubIssueBody(
      { ...baseSubmission, eventSlug: "test-event-2027", logoUrl: "" },
      "DODBR-BRONZE-20270101120000",
      "250.00",
    );

    expect(body).toContain("### Logo URL\n_No response_");
  });

  it("includes invoice reference in body without PII", () => {
    const body = buildGitHubIssueBody(
      { ...baseSubmission, eventSlug: "test-event-2027" },
      "DODBR-BRONZE-20270101120000",
      "250.00",
    );

    expect(body).toContain("DODBR-BRONZE-20270101120000");
    expect(body).not.toContain("jane@acme.com");
    expect(body).not.toContain("ap@acme.com");
    expect(body).not.toContain("555-1234");
    expect(body).not.toContain("Jane Doe");
  });
});

describe("validateSubmission", () => {
  it("returns eventName error when eventName is empty", () => {
    const errors = validateSubmission({ ...baseSubmission, eventName: "" });

    expect(errors).toContain("eventName");
  });

  it("returns eventSlug error when eventSlug is empty", () => {
    const errors = validateSubmission({ ...baseSubmission, eventSlug: "" });

    expect(errors).toContain("eventSlug");
  });

  it("returns no errors for a valid submission", () => {
    const errors = validateSubmission(baseSubmission);

    expect(errors).toHaveLength(0);
  });
});

describe("priceFor", () => {
  it("prices a package within its own Event Year", () => {
    expect(priceFor("dodbr-2026", "Silver")).toBe("600.00");
  });

  it("does not price a package for an unknown Event Year", () => {
    expect(priceFor("spring-2027", "Silver")).toBeUndefined();
  });

  it("does not leak one event's pricing into another", () => {
    // The guard against the real hazard: two events sharing a tier name at
    // different prices must never resolve to each other's amount.
    for (const [slug, packages] of Object.entries(PRICING_TABLE)) {
      for (const name of Object.keys(packages)) {
        expect(priceFor(`${slug}-not-a-real-event`, name)).toBeUndefined();
      }
    }
  });

  it("does not price an unknown package", () => {
    expect(priceFor("dodbr-2026", "Titanium")).toBeUndefined();
  });
});

/**
 * The site renders its comparison table and package dropdown from each event's
 * packages.yaml; this Worker invoices from PRICING_TABLE. They are separate on purpose —
 * a content PR must not be able to change what PayPal charges — but they must agree, or
 * a sponsor sees one price and is billed another. This test is what makes that safe.
 */
describe("PRICING_TABLE matches the published packages.yaml files", () => {
  const eventsDir = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "content", "events");

  const publishedPricing = {};
  for (const slug of readdirSync(eventsDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)) {
    const file = join(eventsDir, slug, "packages.yaml");
    if (!existsSync(file)) continue;
    const data = parseYaml(readFileSync(file, "utf8"));
    publishedPricing[slug] = Object.fromEntries(
      data.packages.map((p) => [p.name, String(p.price)]),
    );
  }

  it("finds at least one event publishing packages", () => {
    expect(Object.keys(publishedPricing).length).toBeGreaterThan(0);
  });

  it("covers exactly the events that publish packages", () => {
    expect(Object.keys(PRICING_TABLE).sort()).toEqual(Object.keys(publishedPricing).sort());
  });

  it.each(Object.keys(publishedPricing))("prices for %s match the site exactly", (slug) => {
    expect(PRICING_TABLE[slug]).toEqual(publishedPricing[slug]);
  });

  it.each(Object.keys(publishedPricing))("%s highlights a real package", (slug) => {
    const file = join(eventsDir, slug, "packages.yaml");
    const data = parseYaml(readFileSync(file, "utf8"));
    if (!data.featured) return;
    expect(data.packages.map((p) => p.name)).toContain(data.featured);
  });
});
