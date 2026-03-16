#!/usr/bin/env bash
set -euo pipefail

AWS_REGION="${AWS_REGION:-us-east-1}"
QUEUE_NAME="${SQS_QUEUE_NAME:-liberialearn-jobs.fifo}"
DLQ_NAME="${SQS_DLQ_NAME:-liberialearn-jobs-dlq.fifo}"

create_fifo_queue() {
  local queue_name="$1"
  local attributes="$2"

  if aws sqs get-queue-url --region "$AWS_REGION" --queue-name "$queue_name" >/dev/null 2>&1; then
    echo "SQS queue exists: $queue_name"
  else
    aws sqs create-queue \
      --region "$AWS_REGION" \
      --queue-name "$queue_name" \
      --attributes "$attributes" >/dev/null
    echo "Created SQS queue: $queue_name"
  fi
}

create_fifo_queue "$DLQ_NAME" "FifoQueue=true,ContentBasedDeduplication=true"
DLQ_URL="$(aws sqs get-queue-url --region "$AWS_REGION" --queue-name "$DLQ_NAME" --query QueueUrl --output text)"
DLQ_ARN="$(aws sqs get-queue-attributes --region "$AWS_REGION" --queue-url "$DLQ_URL" --attribute-names QueueArn --query 'Attributes.QueueArn' --output text)"

create_fifo_queue "$QUEUE_NAME" "FifoQueue=true,ContentBasedDeduplication=true,RedrivePolicy={\"deadLetterTargetArn\":\"$DLQ_ARN\",\"maxReceiveCount\":\"3\"}"
