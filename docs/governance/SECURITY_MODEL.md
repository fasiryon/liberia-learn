# Security Model (V1)

## Threat Model Summary
We assume:
- shared devices
- reused passwords
- weak IT controls in schools
- potential misuse of messaging
- intermittent connectivity

## Controls
- strong session management
- tenant isolation enforcement
- role-based access control (RBAC)
- rate limiting
- audit trails for admin actions
- safe messaging controls (quiet hours, throttles)
- “emergency disable switch” per tenant for critical incidents

## Sensitive Areas (Human-Approved Only)
- authentication logic changes
- tenant boundary logic changes
- permission model changes
- DB migrations in production
- bulk messaging changes