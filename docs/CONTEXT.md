# Background

Optional reading. Why this kind of system exists.

The challenge framing — a research lab tracking instruments — is a stand-in. The pattern is real: any organization owning thousands of physical assets that move around ends up with three systems that each see part of the picture.

## The three systems

- **Operations** (the API you're building against). Owns *where is this thing right now, who has it, what state is it in*. Updated by scans.
- **Facilities**. Owns *what positions exist in the building, what's at each one*. Doesn't track storage, receiving, or disposed items.
- **Finance**. Owns *what we bought, what it's worth, whether it's still on the books*. Sees buildings, not racks.

Each is the authority for its piece. None is the authority for everything.

## Why they drift

Different update cadences. Facilities gets updated when someone bothers. Finance lags by a billing cycle. Operations writes thousands of events a day, one per scan. They never fully agree.

The reconciliation question is which disagreements mean something:

- **Expected** — an asset in storage won't appear in facilities. Different scopes.
- **Real drift** — ops says rack 4, facilities says rack 5. Someone moved it without updating one system.
- **Ambiguous** — ops says disposed, finance says capitalized. Could be a finance lag, could be a real problem.

A good report sorts data into those buckets. A bad one dumps every diff into one list.

## Why scans are the contract

Every state change in ops is triggered by a scan. No manual edits. The scan is the evidence — auditors care about who changed each field, when, and what physical action triggered it. You don't have to build the auditing machinery, but it's why the event log exists.

## Why the hot path matters

A tech scanning at a rack is doing something physically slow (walking, lifting) interrupted by something that has to be digitally fast. If the UI is slow or confusing, techs skip scans. Bad data enters the system. Reconciliation breaks down.

## Things real systems do that this challenge skips

Don't build these. But if your design would prevent layering them on later, flag it in your README.

- Parent-child relationships (chassis with serialized blades).
- Offline scan queueing.
- Tracking the barcode tags themselves as their own assets.
