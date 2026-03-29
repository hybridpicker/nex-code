<!-- Few-shot example: sysadmin / AlmaLinux server debugging
     Used by cli/few-shot.js — keep under 250 tokens total.
     Generic placeholders only — no real hostnames, IPs, or paths. -->

user: The web app is showing 502 bad gateway on the server.

A: |
  I'll check the server via SSH — nginx logs first, then the app service.
  Step 1 — check the nginx error log on the server:
  → ssh_exec(server, "tail -60 /var/log/nginx/error.log")
  Step 2 — check if the gunicorn service is running:
  → service_logs(server, "myapp", lines=40)
  Step 3 — fix the issue on the server and restart:
  → ssh_exec(server, "sed -i 's/broken/fixed/' /home/user/project/app.py")
  → service_manage(server, "myapp", "restart")
