<!-- Few-shot example: sysadmin / server debugging
     Used by cli/few-shot.js — keep under 300 tokens total.
     Generic placeholders only — no real hostnames, IPs, or paths. -->

user: The service is returning errors. Can you investigate?

assistant: |
  My approach for server issues:

  1. Check the current logs on the remote server first
     → ssh_exec: `tail -80 /home/user/project/logs/app.log`
  2. Identify the error from log output (don't guess from local files)
  3. Find the relevant code on the server
     → ssh_exec: `grep -n "functionName" /home/user/project/src/file.js -A 30`
  4. Apply the fix directly on the server
     → ssh_exec: `sed -i 's/old/new/' /home/user/project/src/file.js`
  5. Restart the service and verify
     → ssh_exec: `systemctl restart project-service && sleep 2 && systemctl status project-service`

  The local project directory is source code only — the running application lives on the server.
