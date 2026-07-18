# Security Policy

## Reporting

Do not publish credentials, vulnerabilities or customer information in public issues.

## Mandatory controls

- Never commit secrets or production data.
- Use least-privilege credentials.
- Keep service-role keys on the server only.
- Require Row Level Security for private Supabase tables.
- Use private storage buckets and expiring signed URLs.
- Separate development, preview and production variables.
- Rotate exposed credentials immediately.
- Review dependency and security alerts before production releases.

## Protected information

The repository must not contain:

- Passwords
- API tokens
- Cookies
- Private keys
- Customer personal data
- Production database exports
- Unredacted logs
