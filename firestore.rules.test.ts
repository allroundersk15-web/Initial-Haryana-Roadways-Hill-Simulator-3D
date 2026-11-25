/**
 * Phase 0 Security TDD Specification for Haryana Roadways Hill Simulator Firestore Rules.
 * Verifies the "Dirty Dozen" adversarial payloads against the Eight Pillars invariants.
 */

export interface DirtyDozenCase {
  id: number;
  name: string;
  operation: 'create' | 'update' | 'get' | 'list';
  path: string;
  auth: { uid: string; emailVerified: boolean } | null;
  payload?: Record<string, unknown>;
  expected: 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_PAYLOADS: DirtyDozenCase[] = [
  {
    id: 1,
    name: 'Identity Spoofing on Create',
    operation: 'create',
    path: '/drivers/bob',
    auth: { uid: 'alice', emailVerified: true },
    payload: { uid: 'bob', displayName: 'Fake Bob', depotHome: 'Panchkula' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Unverified Email Write',
    operation: 'create',
    path: '/drivers/alice',
    auth: { uid: 'alice', emailVerified: false },
    payload: { uid: 'alice', displayName: 'Alice', depotHome: 'Ambala' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Shadow Field Injection',
    operation: 'update',
    path: '/drivers/alice',
    auth: { uid: 'alice', emailVerified: true },
    payload: { isAdmin: true, displayName: 'Alice' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'Client Timestamp Forgery',
    operation: 'create',
    path: '/drivers/alice',
    auth: { uid: 'alice', emailVerified: true },
    payload: { uid: 'alice', createdAt: '2020-01-01T00:00:00Z' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'Immutable createdAt Mutation',
    operation: 'update',
    path: '/drivers/alice',
    auth: { uid: 'alice', emailVerified: true },
    payload: { createdAt: '2026-01-01T00:00:00Z' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'Oversized displayName Resource Poisoning',
    operation: 'update',
    path: '/drivers/alice',
    auth: { uid: 'alice', emailVerified: true },
    payload: { displayName: 'A'.repeat(500) },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'Invalid Depot Enum',
    operation: 'update',
    path: '/drivers/alice',
    auth: { uid: 'alice', emailVerified: true },
    payload: { depotHome: 'InvalidDepot' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'Negative Earnings Tampering',
    operation: 'update',
    path: '/drivers/alice',
    auth: { uid: 'alice', emailVerified: true },
    payload: { totalEarningsInr: -500 },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Path ID Poisoning',
    operation: 'create',
    path: '/drivers/alice/tripLogs/bad$id_poison',
    auth: { uid: 'alice', emailVerified: true },
    payload: { driverId: 'alice', routeId: 'kalka-shimla' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'Orphaned Subcollection Write Without Parent Driver Doc',
    operation: 'create',
    path: '/drivers/ghostUser/licenseTests/figure8',
    auth: { uid: 'ghostUser', emailVerified: true },
    payload: { driverId: 'ghostUser', trackId: 'figure8', passed: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'License Track ID Mismatch',
    operation: 'create',
    path: '/drivers/alice/licenseTests/figure8',
    auth: { uid: 'alice', emailVerified: true },
    payload: { driverId: 'alice', trackId: 'gradientRamp', passed: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Cross-User Read Attempt',
    operation: 'get',
    path: '/drivers/alice',
    auth: { uid: 'bob', emailVerified: true },
    expected: 'PERMISSION_DENIED',
  },
];
