#!/bin/bash

source ./Docker/scripts/env_functions.sh

run_with_retry() {
    local description="$1"
    shift

    local max_retries="${DATABASE_DEPLOY_MAX_RETRIES:-30}"
    local retry_delay="${DATABASE_DEPLOY_RETRY_DELAY_SECONDS:-3}"
    local attempt=1

    until "$@"; do
        if [ "$attempt" -ge "$max_retries" ]; then
            echo "$description failed after $attempt attempts"
            return 1
        fi

        echo "$description failed. Waiting ${retry_delay}s before retrying (${attempt}/${max_retries})..."
        attempt=$((attempt + 1))
        sleep "$retry_delay"
    done

    return 0
}

if [ "$DOCKER_ENV" != "true" ]; then
    export_env_vars
fi

if [[ "$DATABASE_PROVIDER" == "postgresql" || "$DATABASE_PROVIDER" == "mysql" || "$DATABASE_PROVIDER" == "psql_bouncer" ]]; then
    export DATABASE_URL
    echo "Deploying migrations for $DATABASE_PROVIDER"
    echo "Database URL: $DATABASE_URL"
    if ! run_with_retry "Database migration" npm run db:deploy; then
        echo "Migration failed"
        exit 1
    else
        echo "Migration succeeded"
    fi
    npm run db:generate
    if [ $? -ne 0 ]; then
        echo "Prisma generate failed"
        exit 1
    else
        echo "Prisma generate succeeded"
    fi
else
    echo "Error: Database provider $DATABASE_PROVIDER invalid."
    exit 1
fi
