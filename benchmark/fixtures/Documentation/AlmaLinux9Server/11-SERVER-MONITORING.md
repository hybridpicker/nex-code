# Server Monitoring

This sanitized fixture summarizes monitoring and verification practices for the
same AlmaLinux host.

## Health Monitoring

- Check systemd services for webhook listeners and application processes.
- Track deployment logs and webhook activity.
- Verify PostgreSQL reachability without exposing port 5432 publicly.
- Review Nginx status and HTTPS availability.

## Useful Verification Commands

```bash
firewall-cmd --list-all
firewall-cmd --list-ports
ss -tulpn
systemctl status nginx
journalctl -u webhook-practice-wizard
```

## Rate Limiting Notes

- HTTPS ingress on port 443 should have request throttling.
- Webhook listeners should stay on dedicated high ports behind Nginx.
- Monitoring should flag ports 9011-9023 and PostgreSQL port 5432.
