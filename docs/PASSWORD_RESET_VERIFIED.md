# Password Reset Verification

Status: pending live verification for the Gap-Closing Sprint.

Expected production configuration:
- `NEXTAUTH_URL=https://liberia-learn.vercel.app`
- Reset links are generated as `/reset-password?token=<token>` on that origin.
- Reset tokens expire after 24 hours.
- The reset endpoint looks up only the hashed token and clears existing sessions after a successful password change.

Live verification checklist:
1. Open `/login` on production.
2. Click "Forgot password".
3. Submit `student1@cha.edu.lr`.
4. Confirm the email provider sends a reset email.
5. Open the reset link from the email.
6. Confirm the reset page loads.
7. Set a temporary password and confirm login works.
8. Reset `student1@cha.edu.lr` back to `DemoSeed2026!`.

Result: not yet run in production from this workspace.
