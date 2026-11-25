# Haryana Roadways Hill Simulator — Firestore Security Specification (Phase 0 TDD)

## 1. Data Invariants

1. **Zero Public Exposure / Strict Owner Isolation**: Every driver document (`/drivers/{driverId}`) and its subcollections (`/licenseTests/{testId}`, `/tripLogs/{tripId}`) may only be read or written by the verified authenticated user whose `request.auth.uid == driverId` and `request.auth.token.email_verified == true`.
2. **Master Gate Relational Sync**: Writes to `/drivers/{driverId}/licenseTests/{testId}` and `/drivers/{driverId}/tripLogs/{tripId}` require `exists(/databases/$(database)/documents/drivers/$(driverId))` so orphaned subcollection records can never exist.
3. **Strict Path ID & Schema Enforcement**: Every document ID path variable is validated with `isValidId()`, every string enforces `.size()` bounds, every numeric counter enforces non-negative realistic caps, and every write validates exact allowed/required keys via `hasAll` + `hasOnly` (no shadow fields).
4. **Temporal & Immutability Integrity**: `createdAt` and `uid`/`driverId` are immutable after creation; timestamps (`createdAt`, `updatedAt`, `completedAt`) must strictly equal `request.time`.
5. **Immutable Trip Manifests**: Completed trip logs (`/tripLogs/{tripId}`) cannot be mutated after creation (`allow update: if false`), preventing retroactive tampering with completed manifests.
6. **Secure List Queries**: `allow list` rules explicitly evaluate `resource.data.driverId == request.auth.uid` (and disallow global `/drivers` collection listing).

## 2. The "Dirty Dozen" Malicious Payloads (Must Return PERMISSION_DENIED)

1. **Identity Spoofing on Create**: User `alice` tries to create `/drivers/bob` with `uid: "bob"`.
2. **Unverified Email Write**: User with `email_verified: false` tries to create `/drivers/alice`.
3. **Shadow Field Injection**: Owner tries to inject `isAdmin: true` or `unlimitedMoney: true` into `/drivers/alice`.
4. **Client Timestamp Forgery**: Owner sends a backdated `createdAt` timestamp instead of `request.time`.
5. **Immutable Field Mutation**: Owner attempts to modify `createdAt` or `uid` on update.
6. **Resource Poisoning (Oversized String)**: Owner writes a 500-character `displayName` exceeding the 80-char limit.
7. **Invalid Enum Value**: Owner writes `depotHome: "MarsDepot"` or `preferredTransmission: "warp"`.
8. **Negative / Overflow Earnings Manipulation**: Owner writes `totalEarningsInr: -500` or `999999999999`.
9. **Path ID Poisoning**: User creates `/drivers/alice/tripLogs/bad$id/../../../etc` with invalid characters.
10. **Orphaned Subcollection Write**: Authenticated user writes `/drivers/alice/licenseTests/figure8` when `/drivers/alice` does not exist.
11. **Track ID Mismatch**: Owner writes `/drivers/alice/licenseTests/figure8` with `trackId: "gradientRamp"`.
12. **Cross-User Read / Blanket List Scrape**: User `bob` attempts to `get` `/drivers/alice` or `list` `/drivers/alice/tripLogs`.
