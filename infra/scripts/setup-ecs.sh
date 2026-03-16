#!/usr/bin/env bash
set -euo pipefail

AWS_REGION="${AWS_REGION:-us-east-1}"
CLUSTER_NAME="${ECS_CLUSTER_NAME:-liberialearn}"
WEB_REPO_NAME="${ECR_WEB_REPO_NAME:-liberialearn-web}"
WORKER_REPO_NAME="${ECR_WORKER_REPO_NAME:-liberialearn-worker}"

ensure_repo() {
  local repo_name="$1"
  if aws ecr describe-repositories --region "$AWS_REGION" --repository-names "$repo_name" >/dev/null 2>&1; then
    echo "ECR repository exists: $repo_name"
  else
    aws ecr create-repository --region "$AWS_REGION" --repository-name "$repo_name" >/dev/null
    echo "Created ECR repository: $repo_name"
  fi
}

if aws ecs describe-clusters --region "$AWS_REGION" --clusters "$CLUSTER_NAME" --query "clusters[0].status" --output text 2>/dev/null | grep -qE 'ACTIVE|PROVISIONING'; then
  echo "ECS cluster exists: $CLUSTER_NAME"
else
  aws ecs create-cluster --region "$AWS_REGION" --cluster-name "$CLUSTER_NAME" >/dev/null
  echo "Created ECS cluster: $CLUSTER_NAME"
fi

ensure_repo "$WEB_REPO_NAME"
ensure_repo "$WORKER_REPO_NAME"

echo "ALB setup deferred to Sprint 6C. Register target groups and listeners separately."
