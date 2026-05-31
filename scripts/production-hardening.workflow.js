export const meta = {
  name: 'sganit-production-hardening',
  description: 'Audit + harden Sganit for production: security (auth cookie/SQLi/multi-tenant/headers/passwords), load/bottlenecks, native alert/confirm -> styled confirm popup',
  phases: [
    { title: 'Investigate', detail: 'parallel read-only audit across 7 dimensions' },
    { title: 'Implement', detail: 'apply safe fixes, partitioned by file to avoid write conflicts' },
    { title: 'Self-check', detail: 'review changed files for compile/logic regressions' },
  ],
}

// ---------------------------------------------------------------------------
// Shared grounding context — VERIFIED against the real codebase by scouting.
// Every agent gets this. The #1 rule: do not break any working flow.
// ---------------------------------------------------------------------------
const CONTEXT = `
PROJECT: "Sganit" — a PRODUCTION multi-tenant school-scheduling system. Treat every change as production-critical. Hebrew is the UI language; never translate UI strings.

ARCHITECTURE (verified):
- Backend: classic ASP.NET "Web Site Project" (App_Code, auto-compiled by IIS Express on port 59212). The ASMX service class is "WebService" in App_Code/WebService.cs (~5237 lines). Raw ADO.NET data access in App_Code/Dal.cs (~879 lines) — note Dal also exposes generic helpers ExeSp/ExecuteNonQuery/GetDataTable that run RAW SQL strings, and many callers in WebService.cs build those SQL strings by CONCATENATION. Scheduling logic: Shibutz.cs (~5362), AssignAuto.cs/AssignAuto2.cs (700 each). Connection string name in web.config is "dbDataConnectionString" (Integrated Security; commented-out historical lines in web.config LEAK old DB passwords — a finding).
- Frontend: React 19 + Vite (port 8080) in ClientApp/. API client: ClientApp/src/api/client.ts exposes ajax(method, params) -> POST /WebService.asmx/<method>. Auth state utils: ClientApp/src/auth/userData.ts + AuthContext.tsx. Styled dialogs already exist: useConfirm from 'ClientApp/src/lib/confirm' (async, returns boolean; call shape: const ok = await confirm({title,message,danger?,confirmText?,cancelText?})) and useToast from 'ClientApp/src/lib/toast'. AdminSchools.tsx already uses both — copy that exact pattern.

AUTH / MULTI-TENANCY — THE REAL MECHANISM (verified; DO NOT BREAK):
- Login is [WebMethod] in WebService.cs around line 684: reads UserName+Password via GetParams(), calls Dal.ExeSp("User_GetUserEnter", UserName, Password) (a STORED PROCEDURE). On success it writes a CLIENT-SIDE cookie named "UserData" containing fields like UserName, RoleId, SchoolId (plaintext). There is NO server-signed token and NO password hashing in C# — password verification happens inside the SP (very likely a plaintext compare; verify by reading the SP if available under sql/ SqlScripts/ scripts/, otherwise state the assumption).
- The frontend reads identity from that "UserData" cookie (auth/userData.ts). RoleId distinguishes the super-admin from a school user.
- Super-admin abilities via ClientApp/src/admin/AdminSchools.tsx: Admin_GetSchoolsDashboard (list), Admin_ImpersonateSchool(SchoolId) -> server re-writes the UserData cookie to that school ("enter any school"), Admin_DeleteSchool, plus an AddSchoolModal that creates schools/users (this is where school passwords are SET). ALL of these MUST keep working.

THE BIGGEST REAL VULNERABILITY: the "UserData" cookie (carrying SchoolId/RoleId) is client-controlled and unsigned, so a user can tamper SchoolId/RoleId to read or modify another school's data or become admin. Server-scoping of every data WebMethod by a TRUSTED server-side identity (signed/encrypted cookie or server Session set at login) is the top priority — and it must still let the admin impersonate.

HARD CONSTRAINTS FOR ANY CHANGE:
1. Never lock existing users out and never bulk-invalidate stored passwords. If you introduce password hashing it MUST be backward-compatible / migrate-on-next-login. If the password mechanism (SP) cannot be safely changed from here, DO NOT guess — implement the safe parts and leave hashing as a documented plan in notImplemented.
2. Keep working: school login, super-admin login, admin create/reset school password (AddSchoolModal flow), admin enter-any-school impersonation.
3. Do NOT rename or change the signatures of ASMX [WebMethod]s the frontend calls by name (see client.ts/usages) — the frontend depends on them.
4. Edit files in place in the current working tree (branch: production-hardening). Use real file:line references.
5. VERIFY claims by reading the actual code; this context is a guide, not gospel — if reality differs, trust the code and say so.
`

const FINDINGS_SCHEMA = {
  type: 'object',
  required: ['dimension', 'summary', 'findings'],
  properties: {
    dimension: { type: 'string' },
    summary: { type: 'string' },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        required: ['title', 'severity', 'file', 'detail', 'recommendation'],
        properties: {
          title: { type: 'string' },
          severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low', 'info'] },
          file: { type: 'string', description: 'path:line if known' },
          detail: { type: 'string' },
          recommendation: { type: 'string' },
          breakingRisk: { type: 'string', description: 'how the fix could break a flow and how to avoid it; "none" if safe' },
        },
      },
    },
  },
}

const IMPL_SCHEMA = {
  type: 'object',
  required: ['area', 'filesChanged', 'changes', 'breakingRiskHandled'],
  properties: {
    area: { type: 'string' },
    filesChanged: { type: 'array', items: { type: 'string' } },
    changes: {
      type: 'array',
      items: {
        type: 'object',
        required: ['file', 'description'],
        properties: { file: { type: 'string' }, description: { type: 'string' } },
      },
    },
    breakingRiskHandled: { type: 'string' },
    notImplemented: { type: 'array', items: { type: 'string' } },
    followUps: { type: 'array', items: { type: 'string' } },
  },
}

const REVIEW_SCHEMA = {
  type: 'object',
  required: ['file', 'verdict', 'issues'],
  properties: {
    file: { type: 'string' },
    verdict: { type: 'string', enum: ['ok', 'risky', 'broken'] },
    issues: {
      type: 'array',
      items: {
        type: 'object',
        required: ['severity', 'detail'],
        properties: {
          severity: { type: 'string', enum: ['compile', 'logic', 'style'] },
          detail: { type: 'string' },
          location: { type: 'string' },
        },
      },
    },
  },
}

// ===========================================================================
// PHASE 1 — INVESTIGATE (parallel, read-only). Barrier before implementation.
// ===========================================================================
phase('Investigate')

const DIMENSIONS = [
  {
    key: 'sqli',
    prompt: `Audit SQL INJECTION. The main risk is in App_Code/WebService.cs where SQL is built by string concatenation (e.g. "... WHERE ConfigurationId=" + cfgId + ...) and passed to Dal.ExecuteNonQuery/GetDataTable/ExeSp. Read App_Code/WebService.cs fully (in chunks) and App_Code/Dal.cs. For EVERY raw/concatenated SQL statement reachable from a [WebMethod] with caller-influenced values, report file:line, the inflowing variable, whether the value is numeric (Helper.ConvertToInt-sanitized) or string, and the exact parameterized rewrite. Prioritize string parameters (true injection) over already-int-sanitized ones (note those as lower severity). Do not report Dal.ExeSp calls that already pass values as SqlParameters.`,
  },
  {
    key: 'tenant',
    prompt: `Audit MULTI-TENANT ACCESS CONTROL / IDOR — the TOP risk. Identity is carried in an UNSIGNED client cookie "UserData" (SchoolId/RoleId). Read the Login method (~line 684), how the UserData cookie is written/read (search "UserData", GetCookie/SetCookie helpers, GetParams), and how WebMethods obtain SchoolId. Determine: (1) Can a school user tamper the cookie's SchoolId to access another school's data, or RoleId to become admin? (2) Do data WebMethods trust a client-supplied SchoolId/ConfigurationId param without checking it belongs to the caller's school? (3) Is there any per-request auth check at all, or are WebMethods callable anonymously? Enumerate vulnerable methods with file:line. Recommend a concrete, low-risk fix: sign/encrypt the UserData cookie (or store identity in server Session at login) + a single helper to read the TRUSTED SchoolId, used to scope/validate every data method — while still allowing Admin_ImpersonateSchool to set the effective school. Describe breakingRisk for each.`,
  },
  {
    key: 'auth',
    prompt: `Audit AUTHENTICATION & PASSWORDS. Read the Login WebMethod (~line 684, uses Dal.ExeSp("User_GetUserEnter", UserName, Password)), Login.aspx.cs, the cookie helpers, AddSchoolModal/Admin school-creation method (where passwords are set), and Admin_ImpersonateSchool. Try to locate the stored procedure User_GetUserEnter (search sql/ SqlScripts/ scripts/ for its definition) to determine if passwords are stored/compared as PLAINTEXT. Report: (1) plaintext password storage/compare (if confirmed/likely) and a SAFE hashing+migration plan that does NOT lock anyone out and keeps the SP-based flow working (e.g. app-layer PBKDF2 hash on set + verify, migrate-on-login; or a hashed column with fallback) — but flag clearly if the SP cannot be safely modified from here (then it's a documented plan, not an auto-fix). (2) Unsigned/forgeable UserData cookie used as the auth token (cross-link to tenant). (3) No brute-force protection on Login. (4) Cookie flags (HttpOnly/Secure/SameSite) — note that fields the frontend must read can't be HttpOnly, so recommend a split: a signed HttpOnly auth cookie for the server + a non-sensitive display cookie for the UI. (5) Any credentials hardcoded in source. Give concrete fixes + breakingRisk each. Preserve admin login, create/reset password, impersonation.`,
  },
  {
    key: 'config',
    prompt: `Audit web.config + infra/secrets. web.config currently has customErrors mode="Off" (leaks stack traces), compilation debug="true", empty <customHeaders>, and commented-out connectionStrings that LEAK real DB passwords (lines ~42-43). Read web.config fully; check for Global.asax; read App_Code/SendEmail.cs for hardcoded SMTP creds. Report with exact snippets to add: security response headers (X-Content-Type-Options:nosniff, X-Frame-Options:SAMEORIGIN, Referrer-Policy, a CONSERVATIVE Content-Security-Policy that won't break the existing app, HSTS guarded for https), customErrors mode="RemoteOnly" with a generic error page, removing the password-leaking commented connection strings, recommending the live connection string + SMTP creds move to a protected/secret config, and whether debug="true" should be false for production (note dev impact). breakingRisk for each.`,
  },
  {
    key: 'perf',
    prompt: `Audit PERFORMANCE & SERVER LOAD. Read App_Code/Dal.cs, App_Code/WebService.cs, App_Code/Shibutz.cs, App_Code/AssignAuto2.cs. Report with file:line: (1) SqlConnection/SqlCommand/SqlDataReader NOT wrapped in using{} (connection leaks that exhaust the pool under load — the connection string caps Max Pool Size=200). (2) N+1 queries (queries inside loops) — there appear to be SqlCommands executed inside loops in WebService.cs (~lines 4157,4284,4413). (3) Whole-table fetches / missing pagination. (4) The auto-assignment algorithm complexity and whether it does DB I/O inside tight loops while holding a request thread. (5) Suggested missing DB indexes (as CREATE INDEX recommendations only — never run them). Rank top bottlenecks under concurrent load.`,
  },
  {
    key: 'alerts',
    prompt: `Inventory native dialogs to convert. Search ClientApp/src for "window.alert", "alert(", "window.confirm", "confirm(". Known hits include ClientApp/src/pages/Assign/AssignAuto.tsx, ClientApp/src/pages/Assign/Assign.tsx, ClientApp/src/admin/AdminSchools.tsx, ClientApp/src/lib/export.ts — re-verify and find ALL. For each: file:line, type (alert=info vs confirm=yes/no), and the exact Hebrew message. Then read ClientApp/src/lib/confirm.tsx (the useConfirm hook) and ClientApp/src/lib/toast to document their EXACT APIs (AdminSchools.tsx already uses: const confirm = useConfirm(); const ok = await confirm({title,message,danger,confirmText,cancelText}); and toast.success/error). Specify, per occurrence, whether it maps to useConfirm (for confirm()) or toast (for informational alert()).`,
  },
  {
    key: 'deadcode',
    prompt: `Assess dead/duplicate code in App_Code. Inspect "App_Code/Shibutz - Copy.cs" (~1717 lines) vs "App_Code/Shibutz.cs" (~5362), "App_Code/AssignAuto.cs" vs "App_Code/AssignAuto2.cs" (both 700 lines), and any .bak/.bak2/-Copy files. For each: does it define the SAME class/namespace as a live file (which in a Web Site Project would normally cause a duplicate-type compile error — so either it's excluded or it's actually different)? Is it referenced anywhere? Determine SAFE-to-delete vs keep, with evidence. Be conservative: only mark deletion when proven unused AND duplicated.`,
  },
]

const investigations = await parallel(
  DIMENSIONS.map((d) => () =>
    agent(`${CONTEXT}\n\n=== YOUR AUDIT TASK (dimension: ${d.key}) ===\n${d.prompt}\n\nReturn structured findings. Be precise with file:line. READ-ONLY — do not edit any file.`, {
      label: `audit:${d.key}`,
      phase: 'Investigate',
      schema: FINDINGS_SCHEMA,
    }).then((r) => ({ key: d.key, ...r }))
  )
)

const findings = investigations.filter(Boolean)
log(`Investigation complete: ${findings.length} dimensions, ${findings.reduce((n, f) => n + (f.findings?.length || 0), 0)} findings`)

// ===========================================================================
// PHASE 2 — IMPLEMENT (parallel, partitioned by FILE OWNERSHIP, disjoint).
// ===========================================================================
phase('Implement')

const byKey = (k) => findings.find((f) => f.key === k) || { findings: [] }
const fj = (k) => JSON.stringify(byKey(k), null, 2)

const IMPL_TASKS = [
  {
    key: 'auth',
    label: 'impl:auth+access-control',
    owns: 'App_Code/WebService.cs and Login.aspx.cs ONLY',
    prompt: `You OWN App_Code/WebService.cs and Login.aspx.cs. Do NOT edit other files (web.config keys are added by another agent — read them via ConfigurationManager.AppSettings if needed).

PRIORITY 1 — FIX THE FORGEABLE-IDENTITY / MULTI-TENANT HOLE (highest value, low lockout risk):
Identity currently rides in an unsigned client cookie "UserData" (SchoolId/RoleId). Make the server stop trusting client-supplied identity:
 - Add a tamper-proof trusted identity: either (a) sign/HMAC or encrypt the UserData cookie (e.g. with MachineKey Protect/Unprotect or a keyed HMAC over SchoolId|RoleId|UserName) and reject/treat-as-anonymous if the signature is invalid, OR (b) set the authoritative SchoolId/RoleId in server Session at login and read identity from Session, keeping the existing UserData cookie only for non-authoritative UI display.
 - Add one helper, e.g. int GetTrustedSchoolId() / string GetTrustedRole(), that returns the server-trusted identity (and, for an admin who is impersonating, the impersonated SchoolId set by Admin_ImpersonateSchool).
 - For school-scoped [WebMethod]s that currently trust a client SchoolId/ConfigurationId, use/validate against GetTrustedSchoolId(). Where a method takes ConfigurationId, verify that configuration belongs to the trusted school. PRESERVE admin impersonation. If tightening a specific method is ambiguous and could break a real call, leave it and record it in notImplemented with the reason — do NOT silently break flows. Use the audit:
TENANT AUDIT:\n${fj('tenant')}

PRIORITY 2 — AUTH HARDENING (only the safe parts; passwords carefully):
${fj('auth')}
 - Add brute-force protection on Login (conservative in-memory per-username throttle; never permanently lock admin).
 - Set proper cookie flags where possible (HttpOnly/Secure/SameSite) on the authoritative cookie; keep any cookie the frontend must read non-HttpOnly but non-authoritative.
 - PASSWORD HASHING: only implement if you can do it WITHOUT locking anyone out and WITHOUT changing a stored proc you cannot verify. If the SP User_GetUserEnter does the plaintext compare and you cannot safely change it from here, DO NOT attempt a partial hash — instead put a precise, safe migration plan in notImplemented (and followUps) for human review. Removing the tenant hole matters more than hashing.

Any SQL you add MUST be parameterized. Do NOT rename/break frontend-called WebMethods. In breakingRiskHandled, explain exactly how school login, admin login, create/reset password, and impersonation still work after your changes.`,
  },
  {
    key: 'dal',
    label: 'impl:dal-sqli+perf',
    owns: 'App_Code/Dal.cs ONLY',
    prompt: `You OWN App_Code/Dal.cs ONLY. Do NOT change existing public method signatures (WebService.cs depends on them; add overloads if needed). Another agent edits WebService.cs in parallel.
 1) Wrap every SqlConnection/SqlCommand/SqlDataReader in using{} so they dispose on exception (critical: pool cap is 200). PERF AUDIT:\n${fj('perf')}
 2) Where Dal builds SQL or accepts raw SQL, add safe parameterized overloads/paths per the SQLi audit, without breaking callers:\n${fj('sqli')}
Only safe, behavior-preserving mechanical changes. Return the structured summary.`,
  },
  {
    key: 'config',
    label: 'impl:web.config+headers',
    owns: 'web.config (and Global.asax.cs if needed) ONLY',
    prompt: `You OWN web.config ONLY (you may create Global.asax.cs for headers if cleaner, and edit App_Code/SendEmail.cs ONLY to move hardcoded SMTP creds to appSettings — nothing else). CONFIG AUDIT:\n${fj('config')}
Apply: security response headers via <system.webServer><httpProtocol><customHeaders> (X-Content-Type-Options:nosniff, X-Frame-Options:SAMEORIGIN, Referrer-Policy:strict-origin-when-cross-origin, a CONSERVATIVE CSP that won't break the app — start permissive and comment it; HSTS commented/guarded for https). Set customErrors mode="RemoteOnly". REMOVE the commented-out connectionStrings that leak DB passwords (lines ~42-43) and add a comment to keep secrets out of source. Be conservative about debug="true" — if turning it false risks breaking IIS Express dev compile, leave it and add a deploy-time comment. Do NOT break the live "dbDataConnectionString". In breakingRiskHandled confirm both dev and prod still load. Return the structured summary.`,
  },
  {
    key: 'frontend',
    label: 'impl:alert->confirm',
    owns: 'ClientApp/src files containing native alert()/confirm() ONLY',
    prompt: `Convert native confirm() to the existing styled "האם אתה בטוח?" popup (useConfirm) and native alert() to the existing toast (or useConfirm info modal if no toast fits). Copy the EXACT pattern already used in ClientApp/src/admin/AdminSchools.tsx (import { useConfirm } from '../lib/confirm'; const confirm = useConfirm(); const ok = await confirm({title,message,danger,confirmText,cancelText}); and useToast). ALERT INVENTORY:\n${fj('alerts')}
Rules: keep Hebrew strings identical; confirm() is sync-boolean so make handlers async/await and only proceed when confirmed; don't change unrelated logic. Return the structured summary listing each converted site.`,
  },
  {
    key: 'cleanup',
    label: 'impl:dead-code-cleanup',
    owns: 'duplicate/.bak junk files in App_Code ONLY (delete proven-unused only)',
    prompt: `Per the DEAD-CODE AUDIT, list the exact files proven to be unused duplicates/backups safe to remove (e.g. "App_Code/Shibutz - Copy.cs", any .bak). DEAD-CODE AUDIT:\n${fj('deadcode')}
Be conservative: if not proven unused AND duplicated, keep it (put in notImplemented). Do NOT touch live source. You may delete a proven-safe file with the file tools if possible; otherwise put the exact paths to delete in followUps for the orchestrator. Return the structured summary.`,
  },
]

const implResults = await parallel(
  IMPL_TASKS.map((t) => () =>
    agent(`${CONTEXT}\n\n=== YOUR IMPLEMENTATION TASK (${t.key}) ===\nYou may edit: ${t.owns}.\n\n${t.prompt}`, {
      label: t.label,
      phase: 'Implement',
      schema: IMPL_SCHEMA,
    }).then((r) => ({ key: t.key, ...r }))
  )
)

const impl = implResults.filter(Boolean)
log(`Implementation complete: ${impl.length} areas, ${impl.reduce((n, r) => n + (r.filesChanged?.length || 0), 0)} files touched`)

// ===========================================================================
// PHASE 3 — SELF-CHECK changed backend files for regressions.
// ===========================================================================
phase('Self-check')

const changedBackend = ['App_Code/WebService.cs', 'App_Code/Dal.cs', 'Login.aspx.cs', 'web.config']
const reviews = await parallel(
  changedBackend.map((file) => () =>
    agent(`Re-read ${file} as it now stands on disk and find ONLY regressions introduced by the hardening edits: C# compile errors (mismatched braces, undeclared symbols, wrong types, duplicate members, missing using directives), broken SQL parameter wiring (@param referenced but not Added, or added but unused), connections not opened/disposed, or logic that would break the school-login / admin-login / impersonation flows. ${CONTEXT}\n\nReturn a verdict (ok/risky/broken) with precise locations. Do not invent issues.`, {
      label: `review:${file}`,
      phase: 'Self-check',
      schema: REVIEW_SCHEMA,
    }).then((r) => ({ file, ...r }))
  )
)

const review = reviews.filter(Boolean)

return {
  findings,
  implementation: impl,
  selfCheck: review,
  summary: {
    dimensionsAudited: findings.length,
    totalFindings: findings.reduce((n, f) => n + (f.findings?.length || 0), 0),
    areasImplemented: impl.length,
    selfCheckVerdicts: review.map((r) => ({ file: r.file, verdict: r.verdict })),
  },
}
