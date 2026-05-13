import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { JSON_HEADERS, getApp, resetDb } from "./helpers.js";
import type { Asset, Event } from "../src/domain/types.js";

const newTagLocation = {
  site: "Lab-Building-A",
  room: "Receiving",
  row: null,
  rack: "DOCK-1",
  ru: null,
};

const storeLocation = {
  site: "Lab-Building-A",
  room: "Storage-1",
  row: null,
  rack: "SHELF-9",
  ru: null,
};

const deployLocation = {
  site: "Lab-Building-A",
  room: "Bay-1",
  row: "Aisle-1",
  rack: "A-01",
  ru: "U10",
};

async function inject(method: "GET" | "POST", url: string, body?: unknown) {
  const app = await getApp();
  return app.inject({
    method,
    url,
    headers: body ? JSON_HEADERS : undefined,
    payload: body ? JSON.stringify(body) : undefined,
  });
}

describe("scans: receive", () => {
  beforeEach(() => {
    resetDb();
  });

  it("creates a new asset on first receive (201)", async () => {
    const res = await inject("POST", "/v1/scans/receive", {
      asset_tag: "C0009001",
      serial: "SN-NEW-1",
      model: "Model X",
      manufacturer: "Acme",
      asset_class: "instrument",
      location: newTagLocation,
      user_id: "tech-jane",
      scan_payload: "RECEIVE|C0009001|SN-NEW-1",
    });
    expect(res.statusCode).toBe(201);
    const body = res.json() as Asset;
    expect(body.asset_tag).toBe("C0009001");
    expect(body.state).toBe("received");
  });

  it("is idempotent on duplicate receive with matching serial (200)", async () => {
    const payload = {
      asset_tag: "C0009002",
      serial: "SN-NEW-2",
      model: "Model X",
      manufacturer: "Acme",
      asset_class: "instrument",
      location: newTagLocation,
      user_id: "tech-jane",
      scan_payload: "RECEIVE|C0009002|SN-NEW-2",
    };
    const first = await inject("POST", "/v1/scans/receive", payload);
    expect(first.statusCode).toBe(201);
    const second = await inject("POST", "/v1/scans/receive", payload);
    expect(second.statusCode).toBe(200);
    const eventsRes = await inject("GET", `/v1/assets/C0009002/events`);
    const events = eventsRes.json() as Event[];
    const dup = events.find((e) => e.event_type === "duplicate_receive");
    expect(dup).toBeDefined();
  });

  it("returns 409 and_match_failed on duplicate tag with different serial", async () => {
    await inject("POST", "/v1/scans/receive", {
      asset_tag: "C0009003",
      serial: "SN-ORIG",
      model: "Model X",
      manufacturer: "Acme",
      asset_class: "instrument",
      location: newTagLocation,
      user_id: "tech-jane",
      scan_payload: "RECEIVE|C0009003|SN-ORIG",
    });
    const res = await inject("POST", "/v1/scans/receive", {
      asset_tag: "C0009003",
      serial: "SN-WRONG",
      model: "Model X",
      manufacturer: "Acme",
      asset_class: "instrument",
      location: newTagLocation,
      user_id: "tech-jane",
      scan_payload: "RECEIVE|C0009003|SN-WRONG",
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe("and_match_failed");
  });

  it("returns 400 invalid_tag_format for bad tag", async () => {
    const res = await inject("POST", "/v1/scans/receive", {
      asset_tag: "BADTAG",
      serial: "SN-1",
      model: "M",
      manufacturer: "M",
      asset_class: "instrument",
      location: newTagLocation,
      user_id: "tech-jane",
      scan_payload: "RECEIVE|BADTAG|SN-1",
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe("invalid_tag_format");
  });
});

describe("scans: store + deploy + transitions", () => {
  beforeEach(() => {
    resetDb();
  });

  it("store: 422 invalid_transition when asset is disposed", async () => {
    const res = await inject("POST", "/v1/scans/store", {
      asset_tag: "C0000109",
      location: storeLocation,
      user_id: "tech-jane",
      scan_payload: "STORE|C0000109",
    });
    expect(res.statusCode).toBe(422);
    expect(res.json().error.code).toBe("invalid_transition");
  });

  it("store: transitions in_service → stored", async () => {
    const res = await inject("POST", "/v1/scans/store", {
      asset_tag: "C0000101",
      location: storeLocation,
      user_id: "tech-jane",
      scan_payload: "STORE|C0000101",
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as Asset;
    expect(body.state).toBe("stored");
    expect(body.location.rack).toBe("SHELF-9");
  });

  it("deploy: 422 incomplete_deploy_location when rack/ru missing", async () => {
    const res = await inject("POST", "/v1/scans/deploy", {
      asset_tag: "C0000107",
      location: { site: "Lab-Building-A", room: "Bay-1", row: null, rack: null, ru: null },
      user_id: "tech-jane",
      scan_payload: "DEPLOY|C0000107",
    });
    expect(res.statusCode).toBe(422);
    expect(res.json().error.code).toBe("incomplete_deploy_location");
  });

  it("deploy: transitions received → in_service", async () => {
    const res = await inject("POST", "/v1/scans/deploy", {
      asset_tag: "C0000107",
      location: deployLocation,
      user_id: "tech-jane",
      scan_payload: "DEPLOY|C0000107",
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as Asset;
    expect(body.state).toBe("in_service");
  });

  it("404 unknown_asset on missing tag", async () => {
    const res = await inject("POST", "/v1/scans/store", {
      asset_tag: "C0099999",
      location: storeLocation,
      user_id: "tech-jane",
      scan_payload: "STORE|C0099999",
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe("unknown_asset");
  });

  it("each scan endpoint writes an event row", async () => {
    await inject("POST", "/v1/scans/store", {
      asset_tag: "C0000101",
      location: storeLocation,
      user_id: "tech-jane",
      scan_payload: "STORE|C0000101",
    });
    const eventsRes = await inject("GET", "/v1/assets/C0000101/events");
    const events = eventsRes.json() as Event[];
    expect(events.length).toBeGreaterThanOrEqual(4);
    expect(events[0]!.event_type).toBe("store");
    expect(events[0]!.user_id).toBe("tech-jane");
  });

  it("no update or delete endpoints exist for events", async () => {
    const app = await getApp();
    const put = await app.inject({ method: "PUT", url: "/v1/events/anything" });
    expect(put.statusCode).toBe(404);
    const del = await app.inject({ method: "DELETE", url: "/v1/events/anything" });
    expect(del.statusCode).toBe(404);
  });
});

describe("scans: transfer", () => {
  beforeEach(() => {
    resetDb();
  });

  it("transfers custody on an in_service asset; state unchanged, custodian updated", async () => {
    const before = await inject("GET", "/v1/assets/C0000101");
    const beforeBody = before.json() as Asset;
    expect(beforeBody.state).toBe("in_service");
    expect(beforeBody.custodian).toBe("tech-jane");

    const res = await inject("POST", "/v1/scans/transfer", {
      asset_tag: "C0000101",
      to_custodian: "tech-mike",
      user_id: "tech-jane",
      scan_payload: "TRANSFER|C0000101|tech-mike",
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as Asset;
    expect(body.state).toBe("in_service");
    expect(body.custodian).toBe("tech-mike");

    const eventsRes = await inject("GET", "/v1/assets/C0000101/events");
    const events = eventsRes.json() as Event[];
    expect(events[0]!.event_type).toBe("transfer_custody");
    expect(events[0]!.user_id).toBe("tech-jane");
  });

  it("rejects transfer when to_custodian equals current custodian", async () => {
    const res = await inject("POST", "/v1/scans/transfer", {
      asset_tag: "C0000101",
      to_custodian: "tech-jane",
      user_id: "tech-jane",
      scan_payload: "TRANSFER|C0000101|tech-jane",
    });
    expect(res.statusCode).toBe(422);
    expect(res.json().error.code).toBe("same_custodian");
  });

  it("rejects transfer on a disposed asset", async () => {
    const res = await inject("POST", "/v1/scans/transfer", {
      asset_tag: "C0000109",
      to_custodian: "tech-mike",
      user_id: "tech-jane",
      scan_payload: "TRANSFER|C0000109|tech-mike",
    });
    expect(res.statusCode).toBe(422);
    expect(res.json().error.code).toBe("invalid_transition");
  });
});

describe("mock writes", () => {
  beforeEach(() => {
    resetDb();
  });

  it("POST /v1/mock/facilities/spaces upserts a rack location; GET reflects it", async () => {
    const post = await inject("POST", "/v1/mock/facilities/spaces", {
      tagged_id: "C0000101",
      rack_location: "Lab-Building-Z/Test-1/Aisle-9/X-99/U99",
    });
    expect(post.statusCode).toBe(200);

    const get = await inject("GET", "/v1/mock/facilities/spaces");
    const rows = get.json() as Array<{ tagged_id: string; rack_location: string }>;
    const row = rows.find((r) => r.tagged_id === "C0000101");
    expect(row?.rack_location).toBe("Lab-Building-Z/Test-1/Aisle-9/X-99/U99");
  });

  it("POST /v1/mock/facilities/spaces with null rack_location removes the row", async () => {
    const post = await inject("POST", "/v1/mock/facilities/spaces", {
      tagged_id: "C0000101",
      rack_location: null,
    });
    expect(post.statusCode).toBe(200);

    const get = await inject("GET", "/v1/mock/facilities/spaces");
    const rows = get.json() as Array<{ tagged_id: string }>;
    expect(rows.find((r) => r.tagged_id === "C0000101")).toBeUndefined();
  });

  it("POST /v1/mock/finance/equipment upserts status; GET reflects it", async () => {
    const post = await inject("POST", "/v1/mock/finance/equipment", {
      tag: "C0000107",
      status: "capitalized",
      book_value_usd: 99999,
    });
    expect(post.statusCode).toBe(200);

    const get = await inject("GET", "/v1/mock/finance/equipment");
    const rows = get.json() as Array<{ tag: string; status: string; book_value_usd: number }>;
    const row = rows.find((r) => r.tag === "C0000107");
    expect(row?.status).toBe("capitalized");
    expect(row?.book_value_usd).toBe(99999);
  });

  it("reset clears mock overlays", async () => {
    await inject("POST", "/v1/mock/facilities/spaces", {
      tagged_id: "C0000101",
      rack_location: "Lab-Building-Z/Test-1/Aisle-9/X-99/U99",
    });
    await inject("POST", "/v1/reset");

    const get = await inject("GET", "/v1/mock/facilities/spaces");
    const rows = get.json() as Array<{ tagged_id: string; rack_location: string }>;
    const row = rows.find((r) => r.tagged_id === "C0000101");
    expect(row?.rack_location).toBe("Lab-Building-A/Bay-12/Aisle-3/B-04/P-02");
  });
});

describe("reset", () => {
  it("reset wipes new assets and re-seeds the fixture", async () => {
    resetDb();
    await inject("POST", "/v1/scans/receive", {
      asset_tag: "C0007777",
      serial: "SN-RESET-TEST",
      model: "M",
      manufacturer: "M",
      asset_class: "instrument",
      location: newTagLocation,
      user_id: "tech-jane",
      scan_payload: "RECEIVE|C0007777|SN-RESET-TEST",
    });
    const before = await inject("GET", "/v1/assets/C0007777");
    expect(before.statusCode).toBe(200);

    const reset = await inject("POST", "/v1/reset");
    expect(reset.statusCode).toBe(200);

    const after = await inject("GET", "/v1/assets/C0007777");
    expect(after.statusCode).toBe(404);

    const seeded = await inject("GET", "/v1/assets/C0000101");
    expect(seeded.statusCode).toBe(200);
  });
});

afterAll(async () => {
  const app = await getApp();
  await app.close();
});
