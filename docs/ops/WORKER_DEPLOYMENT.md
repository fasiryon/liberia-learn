# Worker Service Runbook — NR-2

## Architecture

LiberiaLearn uses an SQS-backed worker service to process asynchronous jobs outside the web
request path. The service runs on ECS Fargate in the `liberia-learn` cluster and consumes
messages from the production FIFO queue.

| Resource | Value |
|---|---|
| ECS Cluster | `liberia-learn` |
| ECS Service | `liberia-learn-worker` |
| Task Definition | `liberia-learn-worker:1` |
| ECR Image | `258048833400.dkr.ecr.us-east-1.amazonaws.com/liberialearn-worker:latest` |
| SQS Queue | `https://sqs.us-east-1.amazonaws.com/258048833400/liberialearn-jobs.fifo` |
| SQS DLQ | `https://sqs.us-east-1.amazonaws.com/258048833400/liberialearn-jobs-dlq.fifo` |
| VPC Subnets | `subnet-0aa1b47b7b852e9ff`, `subnet-052e3f5ab7d4d5912`, `subnet-0130bc7e851532cdb` |
| Security Group | `sg-0d5e38a41c85798be` |
| Log Group | `/ecs/liberia-learn-worker` |
| AWS Region | `us-east-1` |
| AWS Account | `258048833400` |

## What the worker processes

| Job Type | Handler | Status |
|---|---|---|
| `GENERATE_EMBEDDINGS` | `handlers/embeddings.ts` | Live |
| `GENERATE_TEXTBOOK` | `handlers/textbook.ts` | Live |
| `SNAPSHOT_ANALYTICS` | `handlers/analytics.ts` | Live |
| `SEND_SMS` | `handlers/sms.ts` | Live |
| `CONFUSION_DETECTION` | `handlers/intelligence.ts` | Live |
| `GENERATE_COURSE_THUMBNAIL` | `handlers/courseThumbnail.ts` | Live |
| `GENERATE_SCHOOL_ONBOARDING_KIT` | `handlers/onboardingKit.ts` | Live |
| `GENERATE_CERTIFICATION_ASSETS` | `handlers/certificationAssets.ts` | Live |
| `CURRICULUM_REGENERATE_*` | `handlers/curriculumRegeneration.ts` | Live |
| `HEALTH_CHECK` | inline — logs timestamp | Live |
| `QUEUE_READINESS_PROBE` | inline — returns ok | Live |
| `GENERATE_LESSON_AUDIO` | — | Noop (not yet implemented) |
| `STUDENT_IMPORT` | — | Noop (not yet implemented) |
| `AUTONOMOUS_WORKFLOW_RUN` | — | Noop (not yet implemented) |

Unknown job types are acked without processing to prevent DLQ flooding.

## Autoscaling

Scaling is based on SQS `ApproximateNumberOfMessagesVisible` via CloudWatch.

| Parameter | Value |
|---|---|
| Min tasks | 1 |
| Max tasks | 10 |
| Scale-out target | 50 messages |
| Scale-out cooldown | 30 s |
| Scale-in cooldown | 120 s |

## Required SSM Parameters

Secrets are injected from SSM Parameter Store (SecureString) at task launch:

| SSM Path | Env Var |
|---|---|
| `/liberialearn/DATABASE_URL` | `DATABASE_URL` |
| `/liberialearn/DIRECT_URL` | `DIRECT_URL` |
| `/liberialearn/OPENAI_API_KEY` | `OPENAI_API_KEY` |
| `/liberialearn/SQS_QUEUE_URL` | `SQS_QUEUE_URL` |
| `/liberialearn/SQS_DLQ_URL` | `SQS_DLQ_URL` |

Additional SSM parameters needed before full worker feature set is enabled:

- `/liberialearn/ELEVENLABS_API_KEY`
- `/liberialearn/ANTHROPIC_API_KEY`
- `/liberialearn/AFRICASTALKING_API_KEY`
- `/liberialearn/AFRICASTALKING_USERNAME`
- `/liberialearn/SUPABASE_SERVICE_ROLE_KEY`
- `/liberialearn/NEXT_PUBLIC_SUPABASE_URL`

## Manual deployment

Build and push the worker image:

```bash
aws ecr get-login-password --region us-east-1 \
  | docker login --username AWS --password-stdin \
    258048833400.dkr.ecr.us-east-1.amazonaws.com

docker build -t liberialearn-worker -f Dockerfile.worker .
docker tag liberialearn-worker:latest \
  258048833400.dkr.ecr.us-east-1.amazonaws.com/liberialearn-worker:latest
docker push \
  258048833400.dkr.ecr.us-east-1.amazonaws.com/liberialearn-worker:latest
```

Register the task definition:

```bash
aws ecs register-task-definition \
  --cli-input-json file://infra/ecs/worker-task-definition.json \
  --region us-east-1
```

Force a new deployment (picks up latest ECR image):

```bash
aws ecs update-service \
  --cluster liberia-learn \
  --service liberia-learn-worker \
  --force-new-deployment \
  --region us-east-1
```

## Verify the service is running

```bash
# List running tasks
aws ecs list-tasks \
  --cluster liberia-learn \
  --service-name liberia-learn-worker \
  --region us-east-1

# Tail logs
aws logs tail /ecs/liberia-learn-worker --follow --region us-east-1
```

## Check queue backlog

```bash
aws sqs get-queue-attributes \
  --queue-url "https://sqs.us-east-1.amazonaws.com/258048833400/liberialearn-jobs.fifo" \
  --attribute-names ApproximateNumberOfMessages ApproximateNumberOfMessagesNotVisible \
  --region us-east-1
```

## Emergency stop / restart

Scale to zero:

```bash
aws ecs update-service \
  --cluster liberia-learn \
  --service liberia-learn-worker \
  --desired-count 0 \
  --region us-east-1
```

Restore processing:

```bash
aws ecs update-service \
  --cluster liberia-learn \
  --service liberia-learn-worker \
  --desired-count 1 \
  --region us-east-1
```

## Flood test (queue drain verification)

Run outside school hours (Mon–Fri 08:00–15:00 GMT):

```bash
npx dotenv -e .env.production -- npx tsx scripts/flood-test-queue.ts
```

Sends 200 `HEALTH_CHECK` messages; confirm worker drains to 0 within ~5 minutes and
autoscaling kicked in (expect 3–5 tasks at peak).

## IAM roles

| Role | ARN | Policies |
|---|---|---|
| Task Execution | `arn:aws:iam::258048833400:role/ecsTaskExecutionRole` | `AmazonECSTaskExecutionRolePolicy`, `AmazonEC2ContainerRegistryReadOnly`, `AmazonSSMReadOnlyAccess` |
| Task Role | `arn:aws:iam::258048833400:role/ecsTaskRole` | SQS send/receive/delete on `liberialearn-jobs*` |
