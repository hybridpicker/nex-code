# AlmaLinux 9 Server Overview

Last updated: 2026-03-26

This sanitized fixture describes a production Linux host used for web
applications and webhook-driven deployments. It intentionally omits real
addresses, usernames, keys, and secrets.

## Infrastructure Summary

- OS: AlmaLinux 9
- Web server: Nginx
- App runtimes: Gunicorn, Node.js services
- Database: PostgreSQL 13
- Security mode: SELinux enforcing
- SSH access: key-based only, no password login

## Webhook Port Layout

Production webhook services listen on dedicated localhost ports:

- 9011: stadtkapelle webhook
- 9012: musikschule webhook
- 9013: schoensgibl webhook
- 9014: cookbook webhook
- 9016: libremetronome webhook
- 9017: practice wizard webhook
- 9018: chord library webhook
- 9019: vocabulary webhook
- 9020: project manager webhook
- 9021: pro tuner webhook
- 9022: musikschule development webhook
- 9023: cahill webhook

## Firewall Expectations

- Webhook services on ports 9011-9023 are exposed through controlled ingress.
- PostgreSQL listens on 5432 and should remain blocked from external access.
- HTTPS traffic on 443 is protected and should support rate limiting.

## Operational Notes

- Nginx proxies public webhook endpoints to localhost ports.
- Deployment automation uses health checks after each restart.
- Firewall rules are managed with `firewall-cmd`.
