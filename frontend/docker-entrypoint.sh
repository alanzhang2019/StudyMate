#!/bin/sh
# Entrypoint for the frontend container.
#
# Named volumes mount with root ownership by default, which would override
# the chown we did in the Dockerfile. Re-chown /app/data here (running as
# root) so the nextjs user can write into it, then drop privileges.
set -e

mkdir -p /app/data/classrooms \
         /app/data/user-profiles \
         /app/data/classroom-jobs \
         /app/data/mistake-sessions

chown -R nextjs:nodejs /app/data

exec su-exec nextjs:nodejs "$@"
