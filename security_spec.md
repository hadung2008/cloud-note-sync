# Security Specification: Cloud Note Sync

This security spec document defines the attribute-based access controls and zero-trust policies applied to our sync-friendly note storage.

## 1. Data Invariants
- **Strict Owner-Only Access**: A user belongs to a specific `userId`. No other user, signed in or not, can query, read, write, update, or delete another user's notes.
- **Strict Format Enforcements**: All fields must be properly typed, and critical string properties such as titles, content, and colors must be strictly length-bounded to protect against malicious resource exhaustion and overflow injections.
- **Immutable Meta Fields**: Fields representing `createdAt` and `userId` cannot be mutated after a note is created.
- **Server Timestamp Sync**: All creation and modification timestamps (`createdAt`, `updatedAt`) must match `request.time`.

---

## 2. The "Dirty Dozen" Payloads (Aesthetic Attacks and Failures)
These twelve malicious payloads designed to attempt privilege escalations or data pollution MUST be successfully blocked (`PERMISSION_DENIED`) by our security rules.

### Test 1: Blind Unauthenticated Read
- **Operation**: `get` on `/notes/note123`
- **Payload**: None
- **Condition**: User is unauthenticated (`request.auth == null`)
- **Outcome**: `PERMISSION_DENIED`

### Test 2: Insecure Anonymous Access
- **Operation**: `create` on `/notes/note123`
- **Payload**: `{ "title": "Secret", "content": "Note", "userId": "anon", "folder": "personal", "createdAt": request.time, "updatedAt": request.time }`
- **Condition**: Authenticating token does not have an active verified email or valid UID.
- **Outcome**: `PERMISSION_DENIED`

### Test 3: Identity Spoofing On Creation
- **Operation**: `create` on `/notes/note123`
- **Payload**: `{ "title": "Attacker's log", "content": "Text", "userId": "victim_uid", "folder": "personal", "createdAt": request.time, "updatedAt": request.time }`
- **Condition**: User is logged in as `attacker_uid` but submits `userId` as `victim_uid`.
- **Outcome**: `PERMISSION_DENIED`

### Test 4: Shadow Field Injection
- **Operation**: `create` on `/notes/note123`
- **Payload**: `{ "title": "Normal Note", "content": "Clean content", "userId": "user123", "folder": "personal", "createdAt": request.time, "updatedAt": request.time, "ghostRole": "superuser_vip" }`
- **Condition**: Additional un-blueprinted property `ghostRole` is present in payload keys.
- **Outcome**: `PERMISSION_DENIED`

### Test 5: Title Character Buffer Overflow Attack
- **Operation**: `create` on `/notes/note123`
- **Payload**: `{ "title": "A".repeat(1000), "content": "Legit content", "userId": "user123", "folder": "personal", "createdAt": request.time, "updatedAt": request.time }`
- **Condition**: Title exceeds a character size threshold (e.g., > 100 characters).
- **Outcome**: `PERMISSION_DENIED`

### Test 6: Injected Arbitrary Document ID
- **Operation**: `create` on `/notes/junk#$^*_bad_id`
- **Payload**: `{ "title": "Spoofed ID", "content": "Test", "userId": "user123", "folder": "personal", "createdAt": request.time, "updatedAt": request.time }`
- **Condition**: Document ID does not follow slug format `^[a-zA-Z0-9_\-]+$`.
- **Outcome**: `PERMISSION_DENIED`

### Test 7: Impersonating Owner ID on Updates
- **Operation**: `update` on `/notes/note123`
- **Payload**: `{ "title": "Changed Title", "userId": "attacker123", "updatedAt": request.time }`
- **Condition**: Updating existing note where `existing().userId` is user123, but incoming payload attempts to change `userId` to attacker123.
- **Outcome**: `PERMISSION_DENIED`

### Test 8: Timestamp Theft (Client-supplied creation date)
- **Operation**: `create` on `/notes/note123`
- **Payload**: `{ "title": "Backdated Note", "content": "Text", "userId": "user123", "folder": "personal", "createdAt": "2020-01-01T00:00:00Z", "updatedAt": request.time }`
- **Condition**: `createdAt` field does not strictly equal current transaction request server timestamp `request.time`.
- **Outcome**: `PERMISSION_DENIED`

### Test 9: PII Eavesdropping Queries (Blanket Read Bypass)
- **Operation**: `list` on `/notes` without matching query parameters.
- **Payload**: None (Query request from an outsider)
- **Condition**: Query executed without filtering by owner `userId`.
- **Outcome**: `PERMISSION_DENIED`

### Test 10: State Bypass (Malicious modification of immutable fields)
- **Operation**: `update` on `/notes/note123`
- **Payload**: `{ "createdAt": "2020-01-01T00:00:00Z", "updatedAt": request.time }`
- **Condition**: Attempt is made to rewrite immutable timestamp `createdAt`.
- **Outcome**: `PERMISSION_DENIED`

### Test 11: Color Spoofing injection
- **Operation**: `create` on `/notes/note123`
- **Payload**: `{ "title": "Spoofed Color", "content": "Clean", "userId": "user123", "folder": "personal", "createdAt": request.time, "updatedAt": request.time, "color": "rainbow_gold_hax" }`
- **Condition**: The string color is not in the allowed list of categories (slate, blue, amber, emerald, pink, etc.).
- **Outcome**: `PERMISSION_DENIED`

### Test 12: Content Ingestion Flooding Attack
- **Operation**: `update` on `/notes/note123`
- **Payload**: `{ "content": "A".repeat(500000), "updatedAt": request.time }`
- **Condition**: Sizing constraint of note text exceeds 50,000 characters.
- **Outcome**: `PERMISSION_DENIED`

---

## 3. Test Runner Design
These requirements can be evaluated on standard Mock environments or locally inside our React suite via secure simulation.
