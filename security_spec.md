# FrameLex Firestore Security Specification (Phase 0–5)

## Phase 1 & 2: Relationship Mapping & Data Invariants

- **Master Source of Truth**: `/users/{userId}`
  - Every authenticated user owns strictly one profile document at `/users/{userId}` where `userId == request.auth.uid`.
  - User profiles contain PII (`email`, `displayName`, `photoURL`) and are strictly private to the owner (`get`, `create`, `update`, `delete` only when `request.auth.uid == userId`; `list` on `/users` is denied).
- **Private API Key Configuration**: `/users/{userId}/private/apiKeyConfig`
  - Isolated under `private` subcollection with `allow list: if false;` and single-document `docId == 'apiKeyConfig'` constraint.
  - Strictly `isVerifiedOwner(userId)` + `exists(/users/{userId})` + `data.userId == request.auth.uid`. Never readable or writable by any other account or unauthenticated guest.
- **Saved Prompts Subcollection**: `/users/{userId}/prompts/{promptId}`
  - Invariant 1: Every saved prompt belongs to an existing `/users/{userId}` document (Master Gate via `exists()` on single-doc `get`/`create`/`update`/`delete`).
  - Invariant 2: `incoming().userId == request.auth.uid` and `userId == request.auth.uid` on all writes; `userId`, `id`, `sourceType`, and `createdAt` are immutable after creation.
  - Invariant 3: `list` queries strictly enforce `isSignedIn() && request.auth.uid == userId && resource.data.userId == request.auth.uid` with zero `get()`/`exists()` inside `allow list`.
  - Invariant 4: Every string, list, and nested map field is explicitly type-checked and bounded in size.
- **Activity Log Subcollection**: `/users/{userId}/activities/{activityId}`
  - Invariant 1: Every activity entry references an existing `/users/{userId}` document (`exists()` on single-doc create/get/delete).
  - Invariant 2: Activity entries are append-only (`allow update: if false;`), preserving audit integrity.

## Phase 0 & 5: Dirty Dozen Adversarial Payloads (Expected: PERMISSION_DENIED)

1. **Unauthenticated Profile Read**: Unauthenticated client `get('/users/alice')` -> Denied by global catch-all and `isOwner(userId)`.
2. **Cross-User PII Read**: Signed-in `bob` calls `get('/users/alice')` -> Denied by `isOwner(userId)`.
3. **Directory Enumeration**: Signed-in `bob` calls `list('/users')` -> Denied because `/users` has `allow list: if false`.
4. **UID Spoofing on Prompt Create**: Signed-in `bob` creates `/users/bob/prompts/p1` with `userId: "alice"` -> Denied by `data.userId == request.auth.uid`.
5. **Shadow Field Injection on Profile**: Signed-in `alice` creates `/users/alice` with `{ ..., role: "admin" }` -> Denied by `data.keys().hasOnly(...)`.
6. **Unverified Email Spoof**: User with `request.auth.token.email_verified == false` attempts write -> Denied by `isVerifiedOwner(userId)`.
7. **ID Poisoning Attack**: Signed-in `alice` writes `/users/alice/prompts/<1500-char-id>` or `../evil` -> Denied by `isValidId(promptId)`.
8. **Timestamp Forgery on Create**: Signed-in `alice` creates prompt with backdated `createdAt` != `request.time` -> Denied by `incoming().createdAt == request.time`.
9. **Immutable Field Mutation on Update**: Signed-in `alice` updates prompt `createdAt` or `sourceType` or `userId` -> Denied by `affectedKeys().hasOnly(...)` and immutability checks.
10. **Array Bomb / Type Poisoning**: Signed-in `alice` writes `keywords: [12345]` or 100 keywords -> Denied by `data.keywords.size() <= 30` and first-element `is string` guard.
11. **Oversized Payload Denial-of-Wallet**: Signed-in `alice` writes 500KB `activePrompt` string -> Denied by `data.activePrompt.size() <= 40000`.
12. **Activity Tampering**: Signed-in `alice` calls `update('/users/alice/activities/a1', { action: 'deleted' })` -> Denied by `allow update: if false`.
