# Worker Service Runbook

## Architecture

LiberiaLearn uses an SQS-backed worker service to process asynchronous jobs outside the web request path. The service runs as a single ECS Fargate task in the `liberialearn` cluster and consumes messages from the production queue configured by `SQS_QUEUE_URL`.

## What the worker processes

- Curriculum embeddings and RAG chunk sync
- Textbook compilation jobs
- Analytics snapshot jobs
- SMS delivery jobs
- Confusion-detection jobs

## Manual deployment

Register the task definition:

```bash
aws ecs register-task-definition \
  --cli-input-json file://infra/ecs-worker-task-definition.json
```

Create the ECS service:

```bash
aws ecs create-service \
  --cluster liberialearn \
  --service-name liberialearn-worker \
  --task-definition liberialearn-worker \
  --desired-count 1 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-xxxxx],securityGroups=[sg-xxxxx],assignPublicIp=ENABLED}"
```

## How to verify it's running

List active tasks:

```bash
aws ecs list-tasks --cluster liberialearn --service-name liberialearn-worker
```

Tail logs:

```bash
aws logs tail /ecs/liberialearn-worker --follow
```

## How to check queue backlog

```bash
aws sqs get-queue-attributes --queue-url $SQS_QUEUE_URL \
  --attribute-names ApproximateNumberOfMessages
```

## Restart procedure

Force a new deployment:

```bash
aws ecs update-service \
  --cluster liberialearn \
  --service liberialearn-worker \
  --force-new-deployment
```

Scale to zero for emergency stop:

```bash
aws ecs update-service \
  --cluster liberialearn \
  --service liberialearn-worker \
  --desired-count 0
```

Restore processing:

```bash
aws ecs update-service \
  --cluster liberialearn \
  --service liberialearn-worker \
  --desired-count 1
```

## CloudWatch log group

`/ecs/liberialearn-worker`

## Required secrets

The task definition expects these Secrets Manager entries to exist before service creation:

- `liberialearn/DATABASE_URL`
- `liberialearn/DIRECT_URL`
- `liberialearn/SQS_QUEUE_URL`
- `liberialearn/OPENAI_API_KEY`
- `liberialearn/GROQ_API_KEY`

Optional:

- `SQS_DLQ_URL` if a dedicated dead-letter queue is configured
- `SENTRY_DSN` if worker error export should go to Sentry
