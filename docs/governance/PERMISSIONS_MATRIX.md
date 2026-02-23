# Permissions Matrix (V1)

This file defines what each role can do.

## Roles
- Admin
- Teacher
- Student
- Guardian
- School Champion (optional elevated teacher)

## Rules
- Least privilege: default deny
- Tenant-scoped: never cross-tenant
- All privileged actions audited

## Matrix (High-Level)
Admin:
- Manage school settings, branding, users
- View school-wide reports
- Configure messaging policies
- Export data (policy-controlled)

Teacher:
- Create lessons/assignments
- Grade and provide feedback
- Message guardians within policy
- View class-level analytics

Student:
- View daily work
- Submit assignments
- View feedback and mastery progress

Guardian:
- Receive SMS notifications
- (Optional) view student progress if enabled by school policy

School Champion:
- Help onboarding/training visibility
- Access training oversight for school
- Limited support tools (no tenant admin access)