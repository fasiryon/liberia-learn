# Sprint 22 — Google SSO (NextAuth alongside Custom JWT)

**Status:** Planned
**Priority:** Medium — reduces teacher/admin friction at login

**Technical decision locked:** Add NextAuth alongside existing custom JWT. Do NOT replace the existing auth system. Students continue using email/password only.

---

## Goals

1. Teachers and school admins can sign in with their Google account
2. Existing users can link their Google account to their LiberiaLearn account
3. NextAuth sessions and custom JWT sessions coexist without conflict

---

## Scope

### 1. NextAuth Setup

**Package:** `next-auth@5` (v5 = App Router native)

**Provider config (`lib/auth/nextauth.config.ts`):**
```typescript
import GoogleProvider from "next-auth/providers/google";

export const authConfig = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      // Look up existing LiberiaLearn user by email
      // Block if: email not found AND role is not TEACHER/SCHOOL_ADMIN (students can't SSO)
      // Block if: school is not active
      // On success: store googleId on User record
    },
    async session({ session, token }) {
      // Attach liberiaLearnUserId and role to session
    },
    async jwt({ token, user, account }) {
      // Persist userId and role from DB lookup
    },
  },
  pages: {
    signIn: "/login",      // redirect to existing login page
    error: "/login",       // redirect errors back to login
  },
};
```

**NextAuth route:** `app/api/auth/[...nextauth]/route.ts`

---

### 2. User Model — Google Account Linking

**Schema addition:**
```prisma
model User {
  // ... existing fields ...
  googleId       String?  @unique  // populated on first Google SSO login
  googleLinkedAt DateTime?
}
```

**Account linking flow:**
1. User with email `teacher@school.edu` logs in via Google
2. NextAuth `signIn` callback looks up `User` by `email`
3. If found and `googleId` is null: set `googleId = account.providerAccountId`, `googleLinkedAt = now()`
4. If found and `googleId` is already set: allow sign-in normally
5. If not found: reject SSO (must be invited first — no self-registration for teachers via Google)
6. `logAudit` on first link (action: "google_account_linked")

---

### 3. Session Unification

**Coexistence strategy:**
- Custom JWT sessions: stored in `Authorization: Bearer <token>` header (existing API routes)
- NextAuth sessions: stored in `next-auth.session-token` cookie
- Both systems check the same `User` table
- Route handlers that use `requireRole()` continue to work with custom JWT
- New routes added in Sprint 22+ can use NextAuth session; existing routes unchanged

**Helper (`lib/auth/getUnifiedUser.ts`):**
```typescript
async function getUnifiedUser(request: NextRequest): Promise<User | null> {
  // 1. Try custom JWT (Authorization header)
  // 2. Try NextAuth session (cookie)
  // Returns first valid user found
}
```

**Important:** Do not refactor existing routes to use `getUnifiedUser`. Only new routes in Sprint 22 use it.

---

### 4. Login Page UI Changes

**`app/(auth)/login/page.tsx` additions:**
- "Sign in with Google" button (only shown to users on TEACHER/SCHOOL_ADMIN login path)
- Separator: "—— or ——"
- Existing email/password form unchanged below
- If Google SSO is disabled (`ENABLE_GOOGLE_SSO=false`), button is hidden

**Feature flag:** `NEXT_PUBLIC_ENABLE_GOOGLE_SSO` (client-side) + `ENABLE_GOOGLE_SSO` (server-side)

---

### 5. Required Environment Variables

```bash
GOOGLE_CLIENT_ID=...         # from Google Cloud Console
GOOGLE_CLIENT_SECRET=...     # from Google Cloud Console
NEXTAUTH_SECRET=...          # random 32+ char string
NEXTAUTH_URL=https://liberialearn.edu.lr
ENABLE_GOOGLE_SSO=true
NEXT_PUBLIC_ENABLE_GOOGLE_SSO=true
```

Add all to `docs/rollout/ENV_VARS.md` with descriptions.

---

### 6. Schema Migration

`prisma/migrations/20260609_000001_sprint22_google_sso/migration.sql`

```sql
ALTER TABLE "User"
  ADD COLUMN "googleId" TEXT UNIQUE,
  ADD COLUMN "googleLinkedAt" TIMESTAMP(3);

CREATE INDEX CONCURRENTLY IF NOT EXISTS "User_googleId_idx" ON "User"("googleId");
```

---

## Files Touched

- `prisma/schema.prisma` — User.googleId, User.googleLinkedAt
- `prisma/migrations/20260609_000001_sprint22_google_sso/migration.sql` — NEW
- `lib/auth/nextauth.config.ts` — NEW
- `lib/auth/getUnifiedUser.ts` — NEW
- `app/api/auth/[...nextauth]/route.ts` — NEW
- `app/(auth)/login/page.tsx` — add Google SSO button
- `docs/rollout/ENV_VARS.md` — add 5 new vars
- `package.json` — add `next-auth`

## Tests Required

- `__tests__/sprint22.googleSSO.test.ts` — signIn callback, account linking, block non-teacher, block unknown email
- `__tests__/sprint22.unifiedUser.test.ts` — JWT path, NextAuth path, fallback order
- `__tests__/sprint22.loginPage.test.ts` — button visibility based on feature flag

## Caveats

- Google Cloud Console setup required: add `https://liberialearn.edu.lr/api/auth/callback/google` to authorized redirect URIs
- Students will NOT see the Google SSO button — link it only to teacher/admin login paths
- If `NEXTAUTH_SECRET` is not set, NextAuth will throw — add guard like existing `JWT_SECRET` guard
