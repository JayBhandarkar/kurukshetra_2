# PolicyLens Session Management Rules

Always follow these guidelines when implementing or modifying any feature:

1. **Persistent Sessions**:
   - Maintain user sessions across page reloads, browser restarts, and tab changes using dual persistence (`localStorage` and `document.cookie`).
   - Use `getClientSession()`, `setClientSession()`, and `clearClientSession()` from `@/lib/authSession`.

2. **Route Guards & No Redundant Prompts**:
   - When an authenticated user visits `/login` or `/signup`, automatically redirect them to `/` (Home) instead of asking them to fill in their details again.
   - Never show pre-filled mock text in form inputs; always keep inputs blank and protected with anti-autofill measures (`autoComplete="new-password"`).

3. **Verification Enforcement**:
   - Enforce mandatory email verification via Resend before granting login access.
   - Persist `is_verified` status so once a user is verified, they remain verified.
