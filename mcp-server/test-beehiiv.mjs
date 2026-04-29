// Standalone Beehiiv API validation. Run before deploying changes that affect
// the proxy endpoint or the dispatcher's Beehiiv path.
//
// Usage:
//   BEEHIIV_API_KEY=<key> node mcp-server/test-beehiiv.mjs
//
// Creates real subscribers with unique burner emails. Prints subscriber IDs at
// the end. Manual cleanup via the Beehiiv dashboard — DO NOT add automated
// DELETE calls to this file (user directive 2026-04-29).

const KEY = process.env.BEEHIIV_API_KEY;
const PUB_ID = process.env.BEEHIIV_PUBLICATION_ID || "pub_ea72d441-200a-486d-b0e2-34b65bc386b8";
const BASE = "https://api.beehiiv.com/v2";

if (!KEY) {
  console.error("Set BEEHIIV_API_KEY in env first.");
  process.exit(1);
}

const ts = Date.now();
const created = [];

function assert(cond, msg) {
  if (!cond) {
    console.error(`✗ ${msg}`);
    process.exit(1);
  }
  console.log(`  ✓ ${msg}`);
}

async function call(path, body, method = "POST") {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch {}
  return { ok: res.ok, status: res.status, text, json };
}

console.log(`\n=== Beehiiv API E2E test ===`);
console.log(`Publication: ${PUB_ID}`);
console.log(`Timestamp:   ${ts}\n`);

// 1. Create with full payload (UTM + tag-via-Acquisition-Source + multiple custom fields)
console.log("1. Create subscription with full payload…");
const emailA = `zbosneaks+hsrtest-a-${ts}@gmail.com`;
const tagA = `Test Campaign — variant-direct (ts ${ts})`;
const r1 = await call(`/publications/${PUB_ID}/subscriptions`, {
  email: emailA,
  reactivate_existing: false,
  send_welcome_email: false,
  utm_source: "test-script",
  utm_medium: "integration",
  utm_campaign: `test_${ts}`,
  referring_site: "https://localhost",
  custom_fields: [
    { name: "First Name", value: "Test" },
    { name: "Last Name", value: "Subscriber" },
    { name: "Acquisition Source", value: tagA },
  ],
});
assert(r1.ok, `create returned ${r1.status}`);
assert(r1.json?.data?.id, `response has subscription id`);
assert(r1.json?.data?.email === emailA, `email round-trips`);
assert(r1.json?.data?.utm_source === "test-script", `utm_source round-trips`);
const subId = r1.json.data.id;
const customFields = r1.json.data.custom_fields || [];
assert(customFields.some((f) => f.name === "Acquisition Source" && f.value === tagA), `Acquisition Source carries tag value`);
created.push({ email: emailA, id: subId });
console.log(`  → ${subId}`);

// 2. Phone Number type (Beehiiv coerces to integer)
console.log("\n2. Create with phone in E.164 form (verifies coercion behaviour)…");
const emailB = `zbosneaks+hsrtest-b-${ts}@gmail.com`;
const r2 = await call(`/publications/${PUB_ID}/subscriptions`, {
  email: emailB,
  reactivate_existing: false,
  send_welcome_email: false,
  custom_fields: [
    { name: "First Name", value: "Phone" },
    { name: "Phone Number", value: "+447700900123" },
  ],
});
assert(r2.ok, `create with phone returned ${r2.status}`);
const phoneField = (r2.json?.data?.custom_fields || []).find((f) => f.name === "Phone Number");
assert(phoneField, `Phone Number field present`);
assert(phoneField.kind === "integer" || typeof phoneField.value === "number", `Phone Number coerced to integer (kind=${phoneField?.kind})`);
created.push({ email: emailB, id: r2.json?.data?.id });

// 3. Tag attach via dedicated endpoint
console.log("\n3. Attach tag via /subscriptions/<id>/tags…");
const r3 = await call(`/publications/${PUB_ID}/subscriptions/${subId}/tags`, {
  tags: [tagA],
});
assert(r3.ok, `tag attach returned ${r3.status}`);
const tagsBack = r3.json?.data?.tags || [];
assert(tagsBack.length > 0, `tags array returned (${tagsBack.length} entries)`);
// Beehiiv lowercases tags — check case-insensitive containment
const tagSeen = tagsBack.some((t) => t.toLowerCase() === tagA.toLowerCase());
assert(tagSeen, `expected tag is present (case-insensitive)`);

// 4. Sanity: schema mismatch should NOT crash — test with a custom_field that doesn't exist
//    (Beehiiv silently drops it, not 4xx)
console.log("\n4. Custom field that does NOT exist on publication (should be silently dropped, not error)…");
const emailC = `zbosneaks+hsrtest-c-${ts}@gmail.com`;
const r4 = await call(`/publications/${PUB_ID}/subscriptions`, {
  email: emailC,
  reactivate_existing: false,
  send_welcome_email: false,
  custom_fields: [
    { name: "First Name", value: "Drop" },
    { name: "ThisFieldDoesNotExist", value: "should-be-dropped" },
  ],
});
assert(r4.ok, `create still succeeds (${r4.status})`);
const droppedField = (r4.json?.data?.custom_fields || []).find((f) => f.name === "ThisFieldDoesNotExist");
assert(!droppedField, `unknown field was silently dropped (not in custom_fields response)`);
created.push({ email: emailC, id: r4.json?.data?.id });

console.log(`\n✓ ALL CHECKS PASSED\n`);
console.log("Test subscribers created (manual cleanup via Beehiiv dashboard if desired —");
console.log("DO NOT call DELETE on these from any script):");
for (const s of created) {
  console.log(`  - ${s.email}  (${s.id})`);
}
console.log("");
