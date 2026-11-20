# SIM-PPATS Firestore Security Specification (Phase 0 TDD)

## 1. Data Invariants
1. **Master Gate Membership**: Every office subcollection (`/offices/{officeId}/berkas`, `/config`, `/templates`) is accessible ONLY to verified users who are active members in `/offices/{officeId}/members/{uid}` or the bootstrapped office admin (`adipnfatkuri@gmail.com` with `email_verified == true`).
2. **No Self-Assigned Roles**: A non-admin user can NEVER create a `/members/{uid}` document with an arbitrary role or without a matching pre-created `/offices/{officeId}/invites/{inviteId}` document whose `emailLower` matches their verified Google email and whose `role` matches verbatim.
3. **PII Isolation**: `/users/{userId}` and `/offices/{officeId}/members/{memberUid}` are strictly restricted so non-owners cannot read other users' private profile/email data unless they are office admins.
4. **Terminal State Locking**: Once a `berkas` reaches status `'5. Selesai'`, standard `petugas` members cannot modify or delete it; only an office `admin` can override or reopen it.
5. **Immutable Ownership & Timestamps**: `createdAt`, `createdByUid`, `officeId`, and `ownerUid` cannot be modified after creation. Every `create` requires `createdAt == request.time && updatedAt == request.time`; every `update` requires `updatedAt == request.time`.
6. **Zero Blanket List Queries**: Every `allow list` rule validates `resource.data` directly (e.g., `request.auth.uid in resource.data.memberUids` or `isBootstrappedAdmin()`) with zero `get()` or `exists()` lookups inside `allow list`.

## 2. The "Dirty Dozen" Adversarial Payloads (Must All Be Denied)
1. **Shadow Field Injection on Berkas Create**: Adding `"isApproved": true` or `"ghostField": "x"` to a `berkas` create payload → Denied by `keys().hasOnly(...)`.
2. **Identity Spoofing on Berkas Create**: Setting `createdByUid` to another user's UID instead of `request.auth.uid` → Denied by `data.createdByUid == request.auth.uid`.
3. **Self-Assigned Admin Escalation**: Uninvited user creating `/offices/kantor_utama/members/{theirUid}` with `role: "admin"` → Denied because no matching invite exists.
4. **Role Escalation via Invite Mismatch**: User invited as `"petugas"` attempting to create `/members/{theirUid}` with `role: "admin"` → Denied because `incoming().role != invite.role`.
5. **Unverified Email Spoofing**: User with `email: "adipnfatkuri@gmail.com"` but `email_verified: false` attempting admin read/write → Denied by `isVerifiedUser()`.
6. **Cross-User PII Read**: Non-admin user reading `/users/{otherUid}` → Denied by `isOwner(userId) || isBootstrappedAdmin()`.
7. **Terminal State Tampering by Staff**: `petugas` updating a `berkas` whose `existing().status == "5. Selesai"` → Denied by terminal state lock.
8. **Immutable Field Mutation**: Updating `createdByUid`, `createdAt`, or `officeId` on an existing `berkas` → Denied by `affectedKeys().hasOnly(...)` and immutability checks.
9. **Client Timestamp Forgery**: Sending a backdated `createdAt` or `updatedAt` instead of `serverTimestamp()` (`request.time`) → Denied by `incoming().updatedAt == request.time`.
10. **ID Poisoning Attack**: Writing to `/offices/kantor_utama/berkas/../../bad$id!` or a 200-char doc ID → Denied by `isValidId(berkasId)`.
11. **Value Poisoning / Denial-of-Wallet**: Sending a 500KB string in `kode_berkas` or 500 elements in `para_pihak` or `memberUids` → Denied by `.size()` bounds in `isValidBerkas()`.
12. **Unauthorized List Scraping**: Non-member signed-in user attempting `list` on `/offices/kantor_utama/berkas` → Denied by `request.auth.uid in resource.data.memberUids`.
