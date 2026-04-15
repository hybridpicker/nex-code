# Auto Deploy with GitHub Webhooks

This sanitized fixture documents a multi-project deployment setup that uses
dedicated webhook listeners and a shared deployment script.

## Deployment Architecture

1. GitHub sends a push webhook.
2. Nginx forwards the request to a dedicated localhost port.
3. A project-specific webhook process validates the SHA-256 signature.
4. The deployment runner pulls the latest code and restarts the target service.
5. A health check verifies that the service is live.

## Managed Webhook Ports

The server reserves ports 9011-9023 for webhook listeners. Example mapping:

- 9011: project A
- 9017: practice wizard
- 9018: chord library
- 9023: cahill

## Deployment Checklist

- Verify webhook signature before running deploy logic.
- Keep a rollback path for failed deploys.
- Write audit logs with timestamps.
- Run post-deploy verification.

## SSH Rotation Considerations

- Prefer ED25519 keys.
- Keep two active keys during rotation for zero downtime.
- Back up `authorized_keys` before replacement.
- Log every rotation step and keep a rollback action.

## Cron Example

```cron
0 0 1 * * /usr/local/bin/ssh-rotate.sh
```
