--
-- PostgreSQL database dump
--

\restrict E4guNUJRdVRgi5cZTi2qvp0km5ws9E12Tn9Q3Sdhgk6gfXaAeE1arAqMtEEmA9m

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.10

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: AcademicEnrollmentStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."AcademicEnrollmentStatus" AS ENUM (
    'ACTIVE',
    'PROMOTED',
    'GRADUATED',
    'TRANSFERRED',
    'COMPLETED',
    'RETAINED'
);


--
-- Name: AttendanceStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."AttendanceStatus" AS ENUM (
    'PRESENT',
    'ABSENT',
    'LATE',
    'EXCUSED'
);


--
-- Name: CertificateType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."CertificateType" AS ENUM (
    'LESSON',
    'SUBJECT'
);


--
-- Name: CurriculumLessonType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."CurriculumLessonType" AS ENUM (
    'CORE',
    'REVIEW',
    'LAB',
    'ASSESSMENT',
    'PROJECT'
);


--
-- Name: CurriculumMappedSource; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."CurriculumMappedSource" AS ENUM (
    'EXISTING',
    'GENERATED'
);


--
-- Name: CurriculumVersionStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."CurriculumVersionStatus" AS ENUM (
    'DRAFT',
    'ACTIVE',
    'ARCHIVED'
);


--
-- Name: Difficulty; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."Difficulty" AS ENUM (
    'D1',
    'D2',
    'D3',
    'D4',
    'D5'
);


--
-- Name: ExamStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ExamStatus" AS ENUM (
    'DRAFT',
    'PUBLISHED',
    'CLOSED'
);


--
-- Name: GradeBand; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."GradeBand" AS ENUM (
    'G1_3',
    'G4_6',
    'G7_9',
    'G10_12'
);


--
-- Name: ItemType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ItemType" AS ENUM (
    'MCQ',
    'FR',
    'CODE'
);


--
-- Name: MasteryState; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."MasteryState" AS ENUM (
    'NOT_ASSESSED',
    'DEVELOPING',
    'APPROACHING',
    'MASTERED',
    'DECAYING'
);


--
-- Name: ProficiencyState; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ProficiencyState" AS ENUM (
    'NOT_ASSESSED',
    'BELOW_PROFICIENT',
    'APPROACHING',
    'PROFICIENT'
);


--
-- Name: Role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."Role" AS ENUM (
    'TEACHER',
    'STUDENT',
    'GUARDIAN',
    'ADMIN',
    'DISTRICT_ADMIN',
    'MOE_OFFICIAL'
);


--
-- Name: SMSDeliveryStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."SMSDeliveryStatus" AS ENUM (
    'queued',
    'sent',
    'delivered',
    'failed',
    'blocked',
    'opted_out'
);


--
-- Name: SMSMessageType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."SMSMessageType" AS ENUM (
    'absence',
    'at_risk',
    'praise',
    'custom',
    'weekly_digest',
    'assignment_due',
    'certificate_awarded'
);


--
-- Name: StudentImportBatchStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."StudentImportBatchStatus" AS ENUM (
    'PENDING',
    'QUEUED',
    'PROCESSING',
    'COMPLETED',
    'FAILED'
);


--
-- Name: Subject; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."Subject" AS ENUM (
    'MATH',
    'SCIENCE',
    'COMPUTER_SCIENCE',
    'ENGINEERING',
    'LITERACY',
    'CIVICS',
    'ARTS',
    'PE',
    'CAREER',
    'ENGLISH'
);


--
-- Name: TrainingStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."TrainingStatus" AS ENUM (
    'not_started',
    'in_progress',
    'complete'
);


--
-- Name: Weekday; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."Weekday" AS ENUM (
    'MONDAY',
    'TUESDAY',
    'WEDNESDAY',
    'THURSDAY',
    'FRIDAY',
    'SATURDAY',
    'SUNDAY'
);


--
-- Name: prevent_audit_delete(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.prevent_audit_delete() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  RAISE EXCEPTION
    'Audit log records are immutable and cannot be deleted. (row id: %)',
    OLD.id;
  RETURN NULL;
END;
$$;


--
-- Name: prevent_audit_update(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.prevent_audit_update() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  RAISE EXCEPTION
    'Audit log records are immutable and cannot be updated. (row id: %)',
    OLD.id;
  RETURN NULL;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: AIInteraction; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AIInteraction" (
    id text NOT NULL,
    "schoolId" text,
    "userId" text,
    "studentId" text,
    route text,
    feature text,
    "requestType" text,
    "guidanceLevel" text,
    subject text,
    "strandKey" text,
    "contentId" text,
    "lessonId" text,
    provider text,
    model text,
    tier text,
    "hadFallback" boolean DEFAULT false NOT NULL,
    "tokensUsed" integer DEFAULT 0 NOT NULL,
    "estimatedCostUSD" double precision DEFAULT 0 NOT NULL,
    "latencyMs" integer,
    "promptVersion" text,
    "contentVersion" text,
    "assessmentVersion" text,
    "calculationVersion" text,
    metadata jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "promptKey" text,
    "promptHash" text,
    "originalOccurredAt" timestamp(3) without time zone,
    "syncReceivedAt" timestamp(3) without time zone,
    "clientEventId" text,
    "dedupeKey" text,
    "sourceEventId" text
);


--
-- Name: AILiteracyExercise; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AILiteracyExercise" (
    id text NOT NULL,
    "lessonId" text NOT NULL,
    "promptId" text NOT NULL,
    title text NOT NULL,
    type text NOT NULL,
    scenario text NOT NULL,
    "studentPromptInstruction" text,
    rubric jsonb NOT NULL,
    "gradedBy" text DEFAULT 'llm'::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: AcademicEnrollment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AcademicEnrollment" (
    id text NOT NULL,
    "studentId" text NOT NULL,
    "schoolId" text NOT NULL,
    "academicYearId" text NOT NULL,
    grade integer NOT NULL,
    status public."AcademicEnrollmentStatus" DEFAULT 'ACTIVE'::public."AcademicEnrollmentStatus" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "promotedAt" timestamp(3) without time zone,
    "updatedAt" timestamp(3) without time zone DEFAULT now() NOT NULL
);


--
-- Name: AcademicYear; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AcademicYear" (
    id text NOT NULL,
    "schoolId" text NOT NULL,
    "yearLabel" text NOT NULL,
    "startDate" timestamp(3) without time zone NOT NULL,
    "endDate" timestamp(3) without time zone NOT NULL,
    "isActive" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Account; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Account" (
    id text NOT NULL,
    "userId" text NOT NULL,
    type text NOT NULL,
    provider text NOT NULL,
    "providerAccountId" text NOT NULL,
    refresh_token text,
    access_token text,
    expires_at integer,
    token_type text,
    scope text,
    id_token text,
    session_state text
);


--
-- Name: ActionExecution; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ActionExecution" (
    id text NOT NULL,
    "workflowRunId" text NOT NULL,
    "agentDecisionId" text,
    "approvalRequestId" text,
    "actionType" text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    "riskLevel" text DEFAULT 'low'::text NOT NULL,
    "tenantId" text,
    "schoolId" text,
    "targetType" text,
    "targetId" text,
    "traceId" text,
    "idempotencyKey" text,
    "rollbackStatus" text,
    "rollbackRefs" jsonb,
    "inputRefs" jsonb,
    "outputRefs" jsonb,
    "startedAt" timestamp(3) without time zone,
    "completedAt" timestamp(3) without time zone,
    "lastErrorCode" text,
    "lastErrorMessage" text,
    "executionMetadata" jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: AdaptiveMasteryRecord; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AdaptiveMasteryRecord" (
    id text NOT NULL,
    "studentId" text NOT NULL,
    "skillKey" text NOT NULL,
    score double precision DEFAULT 0 NOT NULL,
    "consecutiveCorrect" integer DEFAULT 0 NOT NULL,
    "masteredAt" timestamp(3) without time zone,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Agent; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Agent" (
    id text NOT NULL,
    name text NOT NULL,
    type text NOT NULL,
    status text DEFAULT 'idle'::text NOT NULL,
    config jsonb,
    "lastRunAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: AgentControl; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AgentControl" (
    id text NOT NULL,
    "agentName" text NOT NULL,
    "enabledOverride" boolean,
    "updatedBy" text,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: AgentCostAccounting; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AgentCostAccounting" (
    id text NOT NULL,
    "agentName" text NOT NULL,
    date date NOT NULL,
    "totalInvocations" integer DEFAULT 0 NOT NULL,
    "totalLlmCostUSD" double precision DEFAULT 0 NOT NULL,
    "totalToolCostUnits" integer DEFAULT 0 NOT NULL,
    "uniqueUsers" integer DEFAULT 0 NOT NULL
);


--
-- Name: AgentDecision; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AgentDecision" (
    id text NOT NULL,
    "workflowRunId" text NOT NULL,
    "agentRunId" text,
    "decisionType" text NOT NULL,
    status text DEFAULT 'proposed'::text NOT NULL,
    "riskLevel" text DEFAULT 'low'::text NOT NULL,
    confidence double precision,
    "requiresApproval" boolean DEFAULT false NOT NULL,
    "traceId" text,
    "idempotencyKey" text,
    "evidenceRefs" jsonb,
    decision jsonb NOT NULL,
    explanation jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: AgentGoal; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AgentGoal" (
    id text NOT NULL,
    "agentName" text NOT NULL,
    "initiatedBy" text NOT NULL,
    "goalDescription" text NOT NULL,
    status text DEFAULT 'OPEN'::text NOT NULL,
    state jsonb DEFAULT '{}'::jsonb NOT NULL,
    "pauseReason" text,
    "pauseUntil" timestamp(3) without time zone,
    "humanReviewRequired" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "completedAt" timestamp(3) without time zone,
    "stepCount" integer DEFAULT 0 NOT NULL,
    "lastError" text
);


--
-- Name: AgentInvocation; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AgentInvocation" (
    id text NOT NULL,
    "agentName" text NOT NULL,
    "agentVersion" text NOT NULL,
    "goalId" text,
    "userId" text,
    "triggeredBy" text NOT NULL,
    input jsonb NOT NULL,
    output jsonb,
    "toolCalls" jsonb DEFAULT '[]'::jsonb NOT NULL,
    "llmTokensIn" integer DEFAULT 0 NOT NULL,
    "llmTokensOut" integer DEFAULT 0 NOT NULL,
    "llmCostUSD" double precision DEFAULT 0 NOT NULL,
    "toolCostUnits" integer DEFAULT 0 NOT NULL,
    "latencyMs" integer DEFAULT 0 NOT NULL,
    status text NOT NULL,
    "errorMessage" text,
    "escalationReason" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: AgentMetric; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AgentMetric" (
    id text NOT NULL,
    "agentId" text NOT NULL,
    "tasksCompleted" integer DEFAULT 0 NOT NULL,
    "tasksFailed" integer DEFAULT 0 NOT NULL,
    "avgDurationMs" integer DEFAULT 0 NOT NULL,
    "successRate" double precision DEFAULT 0 NOT NULL,
    "timestamp" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: AgentRun; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AgentRun" (
    id text NOT NULL,
    "workflowRunId" text NOT NULL,
    "agentId" text NOT NULL,
    "tenantId" text,
    "schoolId" text,
    status text DEFAULT 'pending'::text NOT NULL,
    "traceId" text,
    "idempotencyKey" text,
    confidence double precision,
    "riskLevel" text,
    "evidenceRefs" jsonb,
    "inputRefs" jsonb,
    "outputRefs" jsonb,
    "startedAt" timestamp(3) without time zone,
    "completedAt" timestamp(3) without time zone,
    "lastErrorCode" text,
    "lastErrorMessage" text,
    "executionMetadata" jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: AgentTask; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AgentTask" (
    id text NOT NULL,
    "agentId" text NOT NULL,
    "taskType" text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    input jsonb NOT NULL,
    output jsonb,
    error text,
    "startedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "completedAt" timestamp(3) without time zone,
    "durationMs" integer,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: AiInteractionLog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AiInteractionLog" (
    id text NOT NULL,
    "schoolId" text,
    subject text NOT NULL,
    "strandKey" text NOT NULL,
    "requestType" text NOT NULL,
    "guidanceLevel" text,
    "hadFallback" boolean DEFAULT false NOT NULL,
    "estimatedCostUSD" double precision DEFAULT 0 NOT NULL,
    "timestamp" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    endpoint text,
    "tokensUsed" integer DEFAULT 0 NOT NULL,
    "userId" text,
    feature text,
    model text,
    tier text
);


--
-- Name: Announcement; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Announcement" (
    id text NOT NULL,
    "schoolId" text NOT NULL,
    title text NOT NULL,
    body text NOT NULL,
    audience text DEFAULT 'ALL'::text NOT NULL,
    "isPinned" boolean DEFAULT false NOT NULL,
    "publishedAt" timestamp(3) without time zone,
    "expiresAt" timestamp(3) without time zone,
    "createdBy" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: ApprovalRequest; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ApprovalRequest" (
    id text NOT NULL,
    "workflowRunId" text NOT NULL,
    "actionExecutionId" text,
    status text DEFAULT 'pending'::text NOT NULL,
    "riskLevel" text NOT NULL,
    "approvalType" text NOT NULL,
    "tenantId" text,
    "schoolId" text,
    "districtId" text,
    "requestedByType" text,
    "requestedById" text,
    "approverRole" text,
    "approverUserId" text,
    "traceId" text,
    "idempotencyKey" text,
    "evidenceRefs" jsonb,
    "requestPayload" jsonb,
    "decisionPayload" jsonb,
    "requestedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "decidedAt" timestamp(3) without time zone,
    "expiresAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Assessment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Assessment" (
    id text NOT NULL,
    "classId" text,
    "unitId" text,
    title text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: AssessmentAttempt; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AssessmentAttempt" (
    id text NOT NULL,
    "assessmentId" text,
    "assessmentItemId" text,
    "studentId" text,
    "userId" text,
    "schoolId" text,
    "classId" text,
    subject text,
    grade integer,
    "attemptNumber" integer DEFAULT 1 NOT NULL,
    status text DEFAULT 'completed'::text NOT NULL,
    score double precision,
    "maxScore" double precision,
    "rubricScore" double precision,
    "aiAssisted" boolean DEFAULT false NOT NULL,
    "rawResponse" jsonb,
    evaluation jsonb,
    metadata jsonb,
    source text,
    "sourceEventId" text,
    "attemptedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "submittedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "chainId" text
);


--
-- Name: AssessmentAttemptDetail; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AssessmentAttemptDetail" (
    id text NOT NULL,
    "attemptId" text NOT NULL,
    "questionIdx" integer NOT NULL,
    "questionText" text NOT NULL,
    "selectedAnswer" text NOT NULL,
    "correctAnswer" text NOT NULL,
    "isCorrect" boolean NOT NULL,
    "timeSpentSecs" integer
);


--
-- Name: AssessmentItem; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AssessmentItem" (
    id text NOT NULL,
    "assessmentId" text NOT NULL,
    "practiceItemId" text,
    rubric jsonb,
    points integer DEFAULT 1 NOT NULL
);


--
-- Name: Assignment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Assignment" (
    id text NOT NULL,
    "classId" text NOT NULL,
    title text NOT NULL,
    description text,
    "dueAt" timestamp(3) without time zone,
    points integer DEFAULT 100 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "scheduledWorkId" text,
    "contentId" text,
    "moeStandardCodes" text[] DEFAULT '{}'::text[] NOT NULL,
    "generationMethod" text,
    "smsEnabled" boolean DEFAULT false NOT NULL
);


--
-- Name: AssignmentSubmission; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AssignmentSubmission" (
    id text NOT NULL,
    "assignmentId" text NOT NULL,
    "studentId" text NOT NULL,
    "turnedInAt" timestamp(3) without time zone,
    score integer,
    content text,
    feedback text,
    "gradedAt" timestamp(3) without time zone,
    "gradedBy" text,
    "rubricScore" jsonb,
    "aiGrade" integer,
    "aiFeedback" text,
    "aiGradedAt" timestamp(3) without time zone,
    "aiRationale" text,
    "teacherApproved" boolean DEFAULT false NOT NULL,
    "approvedAt" timestamp(3) without time zone,
    "autoReleasedAt" timestamp(3) without time zone
);


--
-- Name: AssignmentSuggestion; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AssignmentSuggestion" (
    id text NOT NULL,
    "schoolId" text NOT NULL,
    "contentId" text NOT NULL,
    "scheduledWorkId" text NOT NULL,
    "classId" text NOT NULL,
    "suggestedTitle" text NOT NULL,
    "suggestedDueDate" timestamp(3) without time zone NOT NULL,
    "moeStandardCodes" text[] DEFAULT '{}'::text[] NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Attendance; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Attendance" (
    id text NOT NULL,
    "studentId" text NOT NULL,
    "classId" text NOT NULL,
    "schoolId" text NOT NULL,
    date timestamp(3) without time zone NOT NULL,
    status public."AttendanceStatus" NOT NULL,
    "markedById" text NOT NULL,
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: AttendanceRecord; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AttendanceRecord" (
    id text NOT NULL,
    "meetingId" text NOT NULL,
    "studentId" text NOT NULL,
    status public."AttendanceStatus" NOT NULL,
    "markedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: AuditLog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AuditLog" (
    id text NOT NULL,
    "userId" text,
    action text NOT NULL,
    details jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "ipAddress" text,
    "resourceId" text,
    "resourceType" text,
    "schoolId" text,
    "traceId" text
);


--
-- Name: BlockScheduleTemplate; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."BlockScheduleTemplate" (
    id text NOT NULL,
    name text NOT NULL,
    slots jsonb NOT NULL,
    level text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: CanvaOAuthCredential; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."CanvaOAuthCredential" (
    id text NOT NULL,
    provider text DEFAULT 'canva'::text NOT NULL,
    "encryptedTokenSet" text NOT NULL,
    "accessTokenExpiresAt" timestamp(3) without time zone,
    scope text,
    "tokenType" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: CanvaOAuthState; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."CanvaOAuthState" (
    id text NOT NULL,
    state text NOT NULL,
    "codeVerifier" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "expiresAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: CapstoneProject; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."CapstoneProject" (
    id text NOT NULL,
    "studentId" text NOT NULL,
    title text NOT NULL,
    summary text,
    "repoUrl" text,
    "mentorId" text,
    "startedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "finishedAt" timestamp(3) without time zone,
    status text DEFAULT 'ACTIVE'::text NOT NULL,
    description text,
    skills jsonb,
    "teacherId" text,
    "fileUrls" jsonb,
    "teacherFeedback" text,
    "submittedAt" timestamp(3) without time zone,
    "reviewedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Certificate; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Certificate" (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    "studentId" text NOT NULL,
    type public."CertificateType" NOT NULL,
    "referenceId" text NOT NULL,
    "awardedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "certificateCode" text NOT NULL,
    "schoolId" text,
    "canvaUrl" text,
    "designId" text,
    status text DEFAULT 'completed'::text NOT NULL,
    "completedAt" timestamp(3) without time zone,
    "generatedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: CertificateShare; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."CertificateShare" (
    id text NOT NULL,
    "certificateId" text NOT NULL,
    "sharedById" text NOT NULL,
    "shareToken" text NOT NULL,
    channel text DEFAULT 'whatsapp'::text NOT NULL,
    "clickCount" integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: ChangeRequestSignoff; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ChangeRequestSignoff" (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    "changeRequestId" text NOT NULL,
    "reviewerUserId" text NOT NULL,
    "reviewerRole" text NOT NULL,
    "schoolId" text,
    decision text NOT NULL,
    comment text,
    "decidedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "traceId" text,
    "idempotencyKey" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: ChatMessage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ChatMessage" (
    id text NOT NULL,
    "studentId" text NOT NULL,
    role text NOT NULL,
    content text NOT NULL,
    "agentId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Class; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Class" (
    id text NOT NULL,
    "schoolId" text NOT NULL,
    name text NOT NULL,
    subject public."Subject" NOT NULL,
    "teacherId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "gradeLevel" integer
);


--
-- Name: CodeExercise; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."CodeExercise" (
    id text NOT NULL,
    "lessonId" text NOT NULL,
    "promptId" text NOT NULL,
    title text NOT NULL,
    description text NOT NULL,
    "starterCode" text NOT NULL,
    "referenceSolution" text NOT NULL,
    "languageId" integer DEFAULT 71 NOT NULL,
    "testCases" jsonb NOT NULL,
    difficulty text DEFAULT 'intro'::text NOT NULL,
    "validatedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: ConfusionSignal; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ConfusionSignal" (
    id text NOT NULL,
    "studentId" text NOT NULL,
    "lessonId" text,
    "conceptTag" text NOT NULL,
    "confusionType" text NOT NULL,
    severity text NOT NULL,
    "schoolId" text NOT NULL,
    "detectedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: ConsentRecord; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ConsentRecord" (
    id text NOT NULL,
    "schoolId" text,
    "userId" text,
    "studentId" text,
    "guardianId" text,
    "consentType" text NOT NULL,
    status text DEFAULT 'granted'::text NOT NULL,
    "legalBasis" text,
    "policyVersion" text,
    source text,
    metadata jsonb,
    "grantedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "revokedAt" timestamp(3) without time zone,
    "expiresAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: ContentQaReview; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ContentQaReview" (
    id text NOT NULL,
    "agentName" text DEFAULT 'content-qa'::text NOT NULL,
    "submissionId" text NOT NULL,
    "submissionType" text NOT NULL,
    score double precision,
    confidence double precision NOT NULL,
    feedback text,
    "rubricUsed" text,
    status text DEFAULT 'PENDING_TEACHER_REVIEW'::text NOT NULL,
    "reviewedBy" text,
    "reviewedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: CurriculumContent; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."CurriculumContent" (
    id text NOT NULL,
    "contentId" text NOT NULL,
    grade integer NOT NULL,
    subject text NOT NULL,
    "contentType" text NOT NULL,
    status text NOT NULL,
    version text NOT NULL,
    payload jsonb NOT NULL,
    "moeAlignments" jsonb,
    hash text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "deliveryProfile" jsonb,
    "unitId" text,
    "embeddedAt" timestamp(3) without time zone,
    embedding public.vector(1536),
    "teacherCreated" boolean DEFAULT false NOT NULL,
    "orderInUnit" integer,
    "lessonType" text,
    title text,
    "versionId" text,
    "thumbnailUrl" text,
    "thumbnailStatus" text DEFAULT 'pending'::text NOT NULL,
    "thumbnailGeneratedAt" timestamp(3) without time zone,
    "thumbnailError" text,
    "editedById" text,
    "editedAt" timestamp(3) without time zone,
    "editReviewStatus" text DEFAULT 'PENDING'::text,
    "isHero" boolean DEFAULT false NOT NULL,
    "learningObjectives" jsonb DEFAULT '[]'::jsonb NOT NULL,
    visibility text DEFAULT 'class_only'::text NOT NULL,
    "parentLessonId" text,
    "lessonVersion" integer DEFAULT 1 NOT NULL,
    "publishedAt" timestamp with time zone,
    "rejectionReason" text,
    "schoolId" text,
    "derivedFromContentId" text,
    "waecSyllabusTopics" text[] DEFAULT ARRAY[]::text[] NOT NULL,
    "heroImageUrl" text,
    "heroImageMeta" jsonb,
    "inlineIllustrations" jsonb,
    "imageGenerationStatus" text DEFAULT 'PENDING'::text NOT NULL,
    "imageGenerationCost" double precision,
    "imageCategory" text
);


--
-- Name: CurriculumFeedback; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."CurriculumFeedback" (
    id text NOT NULL,
    "curriculumId" text NOT NULL,
    action text NOT NULL,
    "rejectionReason" text,
    grade integer NOT NULL,
    subject text NOT NULL,
    "generationMethod" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: CurriculumFlag; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."CurriculumFlag" (
    id text NOT NULL,
    "lessonId" text,
    "schoolId" text,
    "flagType" text DEFAULT 'FLAG_CURRICULUM_REVIEW'::text NOT NULL,
    "sourceSignal" text NOT NULL,
    severity text DEFAULT 'medium'::text NOT NULL,
    status text DEFAULT 'ACTIVE'::text NOT NULL,
    "idempotencyKey" text NOT NULL,
    "avgScore" double precision,
    "retryRate" double precision,
    "schoolCount" integer DEFAULT 1 NOT NULL,
    details jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "resolvedAt" timestamp(3) without time zone,
    "resolvedByUserId" text
);


--
-- Name: CurriculumLessonPlan; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."CurriculumLessonPlan" (
    id text NOT NULL,
    "weekId" text NOT NULL,
    "curriculumContentId" text NOT NULL,
    "dayNumber" integer NOT NULL,
    "lessonType" public."CurriculumLessonType" DEFAULT 'CORE'::public."CurriculumLessonType" NOT NULL,
    "mappedSource" public."CurriculumMappedSource" DEFAULT 'EXISTING'::public."CurriculumMappedSource" NOT NULL,
    "orderIndex" integer NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: CurriculumRegenerationCheckpoint; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."CurriculumRegenerationCheckpoint" (
    id text NOT NULL,
    "runId" text NOT NULL,
    "gradeLevel" integer NOT NULL,
    subject text NOT NULL,
    "lastProcessedContentId" text,
    "plannedCount" integer DEFAULT 0 NOT NULL,
    "processedCount" integer DEFAULT 0 NOT NULL,
    "approvedCount" integer DEFAULT 0 NOT NULL,
    "failedCount" integer DEFAULT 0 NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: CurriculumRegenerationJob; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."CurriculumRegenerationJob" (
    id text NOT NULL,
    "runId" text NOT NULL,
    "curriculumContentId" text NOT NULL,
    "gradeLevel" integer NOT NULL,
    subject text NOT NULL,
    topic text,
    status text DEFAULT 'pending'::text NOT NULL,
    attempt integer DEFAULT 0 NOT NULL,
    "maxAttempts" integer DEFAULT 3 NOT NULL,
    provider text,
    "requestedBy" text,
    "schoolId" text,
    "tenantId" text,
    "lastErrorCode" text,
    "lastErrorMessage" text,
    "idempotencyKey" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: CurriculumRegenerationRun; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."CurriculumRegenerationRun" (
    id text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    "targetStatus" text DEFAULT 'NEEDS_REVIEW'::text NOT NULL,
    "totalPlanned" integer DEFAULT 0 NOT NULL,
    "totalProcessed" integer DEFAULT 0 NOT NULL,
    "totalApproved" integer DEFAULT 0 NOT NULL,
    "totalFailed" integer DEFAULT 0 NOT NULL,
    "currentGradeLevel" integer,
    "currentSubject" text,
    "startedAt" timestamp(3) without time zone,
    "completedAt" timestamp(3) without time zone,
    "stoppedReason" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: CurriculumUnit; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."CurriculumUnit" (
    id text NOT NULL,
    "unitId" text NOT NULL,
    name text NOT NULL,
    description text,
    subject text NOT NULL,
    grade integer NOT NULL,
    "schoolId" text,
    "targetStandardCodes" text[] DEFAULT '{}'::text[] NOT NULL,
    "weekStart" integer NOT NULL,
    "weekEnd" integer NOT NULL,
    "createdById" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    title text,
    "gradeLevel" integer,
    "academicYearId" text,
    "orderIndex" integer
);


--
-- Name: CurriculumVersion; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."CurriculumVersion" (
    id text NOT NULL,
    "versionName" text NOT NULL,
    status public."CurriculumVersionStatus" DEFAULT 'DRAFT'::public."CurriculumVersionStatus" NOT NULL,
    "createdById" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: CurriculumWeek; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."CurriculumWeek" (
    id text NOT NULL,
    "unitId" text NOT NULL,
    "weekNumber" integer NOT NULL,
    theme text NOT NULL,
    "orderIndex" integer NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: DataAccessLog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."DataAccessLog" (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    "userId" text,
    "schoolId" text,
    "resourceType" text NOT NULL,
    "resourceId" text,
    action text NOT NULL,
    scope text,
    "traceId" text,
    "ipAddress" text,
    metadata jsonb,
    "accessedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: DataPolicyAcceptance; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."DataPolicyAcceptance" (
    id text NOT NULL,
    "userId" text,
    "schoolId" text,
    "policyKey" text NOT NULL,
    "policyVersion" text NOT NULL,
    source text,
    locale text,
    metadata jsonb,
    "acceptedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "ipAddress" text
);


--
-- Name: DerivedStudentProgress; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."DerivedStudentProgress" (
    id text NOT NULL,
    "studentId" text NOT NULL,
    "schoolId" text,
    subject text NOT NULL,
    "strandKey" text,
    "sourceProfileId" text,
    "sourceAttemptId" text,
    "sourceSnapshotId" text,
    "sourceChainId" text,
    "derivationType" text DEFAULT 'mastery_refresh'::text NOT NULL,
    "progressVersion" text,
    "currentScore" double precision,
    "baselineScore" double precision,
    "growthDelta" double precision,
    "hybridScore" double precision,
    "sustainabilityIndex" double precision,
    "decayRate" double precision,
    "aiRelianceRate" double precision,
    "proficiencyState" text,
    "masteryState" text,
    "misconceptionCount" integer DEFAULT 0 NOT NULL,
    "openInterventionChainCount" integer DEFAULT 0 NOT NULL,
    metadata jsonb,
    "derivedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: DiscussionLastRead; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."DiscussionLastRead" (
    id text NOT NULL,
    "userId" text NOT NULL,
    "threadId" text NOT NULL,
    "readAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: DiscussionPost; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."DiscussionPost" (
    id text NOT NULL,
    "threadId" text NOT NULL,
    "authorId" text NOT NULL,
    "authorRole" text NOT NULL,
    body text NOT NULL,
    "parentPostId" text,
    upvotes integer DEFAULT 0 NOT NULL,
    flagged boolean DEFAULT false NOT NULL,
    pending boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: DiscussionThread; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."DiscussionThread" (
    id text NOT NULL,
    "classId" text NOT NULL,
    "schoolId" text NOT NULL,
    "contentId" text,
    title text NOT NULL,
    "authorId" text NOT NULL,
    "authorRole" text NOT NULL,
    pinned boolean DEFAULT false NOT NULL,
    locked boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: DiscussionUpvote; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."DiscussionUpvote" (
    id text NOT NULL,
    "postId" text NOT NULL,
    "userId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: District; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."District" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    name text NOT NULL,
    region text NOT NULL,
    code text,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: DistrictUpdateDraft; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."DistrictUpdateDraft" (
    id text NOT NULL,
    "agentName" text DEFAULT 'district-update'::text NOT NULL,
    type text NOT NULL,
    scope text NOT NULL,
    "scopeId" text NOT NULL,
    "draftText" text NOT NULL,
    "dataSnapshot" jsonb NOT NULL,
    "changesSummary" jsonb,
    status text DEFAULT 'DRAFT'::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Enrollment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Enrollment" (
    id text NOT NULL,
    "studentId" text NOT NULL,
    "classId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: EscalationQueue; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."EscalationQueue" (
    id text NOT NULL,
    "agentName" text NOT NULL,
    "invocationId" text,
    "goalId" text,
    "userId" text,
    reason text NOT NULL,
    priority text DEFAULT 'MEDIUM'::text NOT NULL,
    "assignedTo" text,
    status text DEFAULT 'OPEN'::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "resolvedAt" timestamp(3) without time zone,
    resolution text
);


--
-- Name: EvalRun; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."EvalRun" (
    id text NOT NULL,
    "runAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "datasetSize" integer NOT NULL,
    "avgRecallAt5" double precision NOT NULL,
    "avgPrecisionAt5" double precision NOT NULL,
    "avgGrounding" double precision NOT NULL,
    "fallbackRate" double precision NOT NULL,
    passed boolean NOT NULL,
    "resultJson" jsonb NOT NULL
);


--
-- Name: Exam; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Exam" (
    id text NOT NULL,
    title text NOT NULL,
    subject text NOT NULL,
    grade integer NOT NULL,
    "schoolId" text NOT NULL,
    "createdBy" text NOT NULL,
    status public."ExamStatus" DEFAULT 'DRAFT'::public."ExamStatus" NOT NULL,
    "moeStandards" text[],
    "timeLimit" integer NOT NULL,
    "passingScore" double precision DEFAULT 0.70 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "deletedAt" timestamp(3) without time zone,
    "academicYearId" text,
    "classId" text,
    "publishedAt" timestamp(3) without time zone,
    "resultsPublishedAt" timestamp(3) without time zone
);


--
-- Name: ExamAttempt; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ExamAttempt" (
    id text NOT NULL,
    "examId" text NOT NULL,
    "studentId" text NOT NULL,
    answers integer[],
    score double precision NOT NULL,
    passed boolean NOT NULL,
    "startedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "submittedAt" timestamp(3) without time zone,
    "integrityFlags" text[],
    "tabSwitchCount" integer DEFAULT 0 NOT NULL,
    "durationSeconds" integer,
    "integrityMetadata" jsonb,
    "submissionLog" jsonb
);


--
-- Name: ExamCertification; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ExamCertification" (
    id text NOT NULL,
    "studentId" text NOT NULL,
    "examId" text NOT NULL,
    subject text NOT NULL,
    grade integer NOT NULL,
    score double precision NOT NULL,
    "issuedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "certCode" text NOT NULL,
    "bannerUrl" text,
    "videoUrl" text,
    "assetGenerationStatus" text DEFAULT 'pending'::text NOT NULL
);


--
-- Name: ExamQuestion; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ExamQuestion" (
    id text NOT NULL,
    "examId" text NOT NULL,
    prompt text NOT NULL,
    options text[],
    "correctIndex" integer NOT NULL,
    explanation text NOT NULL,
    "moeCode" text NOT NULL,
    points integer DEFAULT 1 NOT NULL
);


--
-- Name: ExecutionTrace; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ExecutionTrace" (
    id text NOT NULL,
    "traceId" text NOT NULL,
    "workflowRunId" text,
    "parentTraceId" text,
    "spanType" text NOT NULL,
    "spanName" text NOT NULL,
    status text DEFAULT 'started'::text NOT NULL,
    "tenantId" text,
    "schoolId" text,
    "actorType" text,
    "actorId" text,
    "startedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "endedAt" timestamp(3) without time zone,
    "durationMs" integer,
    metadata jsonb,
    "errorCode" text,
    "errorMessage" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: ExportJobRequest; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ExportJobRequest" (
    id text NOT NULL,
    "requestedByUserId" text,
    "approvedByUserId" text,
    "schoolId" text,
    scope text NOT NULL,
    "scopeId" text,
    "exportType" text NOT NULL,
    format text DEFAULT 'csv'::text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    "approvalStatus" text DEFAULT 'pending'::text NOT NULL,
    filters jsonb,
    metadata jsonb,
    "requestedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "approvedAt" timestamp(3) without time zone,
    "completedAt" timestamp(3) without time zone,
    "downloadUrl" text,
    checksum text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: ExportRecord; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ExportRecord" (
    id text NOT NULL,
    "userId" text,
    "exportType" text NOT NULL,
    scope text NOT NULL,
    "scopeId" text,
    filters jsonb,
    format text,
    "pilotOnly" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: GeneratedDocument; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."GeneratedDocument" (
    id text NOT NULL,
    "schoolId" text NOT NULL,
    "studentId" text,
    type text NOT NULL,
    status text DEFAULT 'PENDING'::text NOT NULL,
    "canvaDesignId" text,
    "canvaUrl" text,
    "downloadUrl" text,
    metadata jsonb,
    "requestedBy" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Grade; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Grade" (
    id text NOT NULL,
    "classId" text NOT NULL,
    "studentId" text NOT NULL,
    percent double precision NOT NULL,
    letter text NOT NULL,
    "computedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: GradePipelineJob; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."GradePipelineJob" (
    id text NOT NULL,
    grade integer NOT NULL,
    subjects text[],
    status text DEFAULT 'NOT_STARTED'::text NOT NULL,
    "currentSubject" text,
    "errorMessage" text,
    attempts integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "startedAt" timestamp(3) without time zone,
    "completedAt" timestamp(3) without time zone,
    "failedAt" timestamp(3) without time zone
);


--
-- Name: GradedSubmission; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."GradedSubmission" (
    id text NOT NULL,
    "studentId" text NOT NULL,
    "lessonId" text NOT NULL,
    "exerciseType" text NOT NULL,
    "promptId" text,
    "submissionText" text NOT NULL,
    score double precision,
    "maxScore" double precision DEFAULT 1 NOT NULL,
    "rubricBreakdown" jsonb,
    feedback text,
    status text DEFAULT 'pending'::text NOT NULL,
    "gradedAt" timestamp(3) without time zone,
    "clientSubmissionId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: GuardianConsent; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."GuardianConsent" (
    id text NOT NULL,
    "schoolId" text NOT NULL,
    "studentId" text NOT NULL,
    "guardianId" text NOT NULL,
    "smsOptIn" boolean DEFAULT false NOT NULL,
    "optedOutAt" timestamp(3) without time zone,
    source text,
    "pilotOnly" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: GuardianConversation; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."GuardianConversation" (
    id text NOT NULL,
    "guardianPhone" text NOT NULL,
    "guardianId" text,
    "verifiedAt" timestamp(3) without time zone,
    "verificationAttempts" integer DEFAULT 0 NOT NULL,
    state jsonb DEFAULT '{}'::jsonb NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "expiresAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: GuardianMessage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."GuardianMessage" (
    id text NOT NULL,
    "guardianId" text NOT NULL,
    "teacherId" text NOT NULL,
    "studentId" text NOT NULL,
    "schoolId" text NOT NULL,
    "fromRole" text NOT NULL,
    body text NOT NULL,
    "sentAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    read boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: GuardianSmsCostAccounting; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."GuardianSmsCostAccounting" (
    id text NOT NULL,
    "guardianPhone" text NOT NULL,
    date date NOT NULL,
    "outboundCount" integer DEFAULT 0 NOT NULL,
    "outboundSegments" integer DEFAULT 0 NOT NULL,
    "estimatedCostUSD" double precision DEFAULT 0 NOT NULL
);


--
-- Name: Homework; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Homework" (
    id text NOT NULL,
    "classId" text NOT NULL,
    title text NOT NULL,
    "dueAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    instructions text,
    questions jsonb,
    description text,
    "createdById" text NOT NULL,
    "rubricJson" jsonb,
    "scheduledWorkId" text,
    "contentId" text,
    "moeStandardCodes" text[] DEFAULT '{}'::text[] NOT NULL,
    "generationMethod" text
);


--
-- Name: HomeworkSubmission; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."HomeworkSubmission" (
    id text NOT NULL,
    "homeworkId" text NOT NULL,
    "studentId" text NOT NULL,
    "aiFeedback" jsonb,
    "aiScore" double precision,
    answers jsonb,
    "submittedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "teacherNotes" text,
    "teacherScore" double precision,
    "aiReviewed" boolean DEFAULT false NOT NULL,
    "clientSubmissionId" text
);


--
-- Name: ImpactSnapshot; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ImpactSnapshot" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    "schoolId" text,
    "classId" text,
    period text NOT NULL,
    "proficiencyRate" double precision NOT NULL,
    "avgMasteryScore" double precision NOT NULL,
    "masteryDelta" double precision NOT NULL,
    "growthDelta" double precision NOT NULL,
    "effectSize" double precision,
    "statisticallyMeaningful" boolean NOT NULL,
    "confidenceLabel" text NOT NULL,
    "sampleSize" integer DEFAULT 0 NOT NULL,
    "generatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Intervention; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Intervention" (
    id text NOT NULL,
    "tenantId" text,
    "schoolId" text,
    "districtId" text,
    "studentId" text,
    "teacherUserId" text,
    "recommendationId" text,
    "interventionType" text NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    channel text,
    priority text,
    objective text,
    details jsonb,
    outcome jsonb,
    "openedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "dueAt" timestamp(3) without time zone,
    "closedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "chainId" text,
    "chainStage" text,
    "sourceEventId" text,
    "attributionSource" text,
    "openedByUserId" text,
    "closedByUserId" text,
    "sourceAttemptId" text
);


--
-- Name: InterventionChain; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."InterventionChain" (
    id text NOT NULL,
    "tenantId" text,
    "schoolId" text,
    "districtId" text,
    "studentId" text,
    "teacherUserId" text,
    "openedByUserId" text,
    "openedByRole" text,
    "attributionSource" text,
    status text DEFAULT 'open'::text NOT NULL,
    "currentStage" text DEFAULT 'baseline'::text NOT NULL,
    rationale text,
    "sourceAssessmentAttemptId" text,
    "baselineSnapshotId" text,
    "latestInterventionId" text,
    metadata jsonb,
    "openedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "interventionStartedAt" timestamp(3) without time zone,
    "outcomeMeasuredAt" timestamp(3) without time zone,
    "retentionCheckedAt" timestamp(3) without time zone,
    "closedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: InterventionLog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."InterventionLog" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    "schoolId" text NOT NULL,
    "districtId" text,
    "interventionPriorityScore" double precision NOT NULL,
    "growthRiskFlag" text NOT NULL,
    "recommendedActionCount" integer NOT NULL,
    "aiEnhanced" boolean DEFAULT false NOT NULL,
    "generatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "outcomeCheckedAt" timestamp(3) without time zone,
    "outcomeDelta" double precision,
    "outcomeEffectSize" double precision,
    "outcomeBaselineStart" timestamp(3) without time zone,
    "outcomeBaselineEnd" timestamp(3) without time zone,
    "outcomeFollowupStart" timestamp(3) without time zone,
    "outcomeFollowupEnd" timestamp(3) without time zone,
    "outcomeBaselineCount" integer,
    "outcomeFollowupCount" integer
);


--
-- Name: InterventionRecommendation; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."InterventionRecommendation" (
    id text NOT NULL,
    "studentId" text NOT NULL,
    "lessonId" text,
    "recommendationType" text NOT NULL,
    reason text NOT NULL,
    "confidenceScore" double precision NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    "expiresAt" timestamp(3) without time zone,
    "schoolId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "idempotencyKey" text,
    severity text DEFAULT 'medium'::text NOT NULL,
    "sourceSignal" text,
    "targetType" text,
    "targetId" text,
    "resolvedAt" timestamp(3) without time zone,
    "resolvedBy" text,
    "dismissedAt" timestamp(3) without time zone,
    "dismissReason" text
);


--
-- Name: InviteToken; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."InviteToken" (
    id text NOT NULL,
    token text NOT NULL,
    email text,
    role text DEFAULT 'TEACHER'::text NOT NULL,
    "schoolId" text NOT NULL,
    "usedAt" timestamp(3) without time zone,
    "expiresAt" timestamp(3) without time zone NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "tokenType" text DEFAULT 'ONBOARD'::text NOT NULL,
    "studentId" text,
    relation text,
    "tokenHash" text
);


--
-- Name: LabSession; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."LabSession" (
    id text NOT NULL,
    "labId" text NOT NULL,
    "studentId" text NOT NULL,
    "scheduledWorkId" text,
    "schoolId" text NOT NULL,
    "startedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "completedAt" timestamp(3) without time zone,
    observations jsonb,
    conclusions text,
    score integer,
    "teacherFeedback" text,
    "masteryUpdated" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "aiAnalysis" jsonb
);


--
-- Name: LeagueSnapshot; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."LeagueSnapshot" (
    id text NOT NULL,
    "schoolId" text NOT NULL,
    term text NOT NULL,
    "avgGrade" double precision NOT NULL,
    attendance double precision NOT NULL,
    "lessonCompletion" double precision NOT NULL,
    "studentCount" integer NOT NULL,
    "countyRank" integer,
    "nationalRank" integer,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "districtRank" integer
);


--
-- Name: LeagueWeekSnapshot; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."LeagueWeekSnapshot" (
    id text NOT NULL,
    district text NOT NULL,
    "weekStart" timestamp(3) without time zone NOT NULL,
    "weekEnd" timestamp(3) without time zone NOT NULL,
    "schoolId" text NOT NULL,
    "schoolName" text NOT NULL,
    rank integer NOT NULL,
    score double precision NOT NULL,
    "pointsTotal" double precision NOT NULL,
    "enrollmentCount" integer NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: LearningEvent; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."LearningEvent" (
    id text NOT NULL,
    "schoolId" text,
    "districtId" text,
    "classId" text,
    "userId" text,
    "studentId" text,
    "actorType" text,
    "actorId" text,
    "actorRole" text,
    "targetType" text,
    "targetId" text,
    "eventType" text NOT NULL,
    source text,
    status text DEFAULT 'accepted'::text NOT NULL,
    "occurredAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "originalOccurredAt" timestamp(3) without time zone,
    "syncReceivedAt" timestamp(3) without time zone,
    "clientEventId" text,
    "dedupeKey" text,
    "replayOfEventId" text,
    "replaySequence" integer,
    "isReplay" boolean DEFAULT false NOT NULL,
    "contentId" text,
    "lessonId" text,
    "unitId" text,
    "termId" text,
    subject text,
    grade integer,
    "curriculumVersion" text,
    "promptVersion" text,
    "assessmentVersion" text,
    "calculationVersion" text,
    metadata jsonb,
    "qualityMarkers" jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "workflowRunId" text,
    "workflowTraceId" text,
    "correlationId" text
);


--
-- Name: LearningPathQueue; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."LearningPathQueue" (
    id text NOT NULL,
    "studentId" text NOT NULL,
    "lessonId" text NOT NULL,
    reason text NOT NULL,
    priority integer DEFAULT 0 NOT NULL,
    "resolvedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Lesson; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Lesson" (
    id text NOT NULL,
    "unitId" text NOT NULL,
    title text NOT NULL,
    objectives jsonb NOT NULL,
    "durationMins" integer DEFAULT 45 NOT NULL
);


--
-- Name: LessonAudio; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."LessonAudio" (
    id text NOT NULL,
    "lessonId" text NOT NULL,
    "storageUrl" text,
    voice text DEFAULT 'alloy'::text NOT NULL,
    "durationSeconds" integer,
    "generatedAt" timestamp(3) without time zone,
    "contentVersion" text NOT NULL,
    status text DEFAULT 'PENDING'::text NOT NULL,
    "estimatedCostUsd" double precision DEFAULT 0 NOT NULL,
    "audioParts" jsonb
);


--
-- Name: LessonHelpFlag; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."LessonHelpFlag" (
    id text NOT NULL,
    "studentId" text NOT NULL,
    "contentId" text NOT NULL,
    note text,
    resolved boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "flagType" text,
    "resolvedAt" timestamp with time zone
);


--
-- Name: LessonPrerequisite; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."LessonPrerequisite" (
    id text NOT NULL,
    "lessonId" text NOT NULL,
    "prerequisiteLessonId" text NOT NULL,
    strength text DEFAULT 'required'::text NOT NULL
);


--
-- Name: LessonShare; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."LessonShare" (
    id text NOT NULL,
    "lessonId" text NOT NULL,
    "sharedById" text NOT NULL,
    "schoolId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: LessonVariant; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."LessonVariant" (
    id text NOT NULL,
    "lessonId" text NOT NULL,
    "variantType" text NOT NULL,
    body text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: LessonVersion; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."LessonVersion" (
    id text NOT NULL,
    "lessonId" text NOT NULL,
    "authorId" text NOT NULL,
    "bodyHtml" text NOT NULL,
    metadata jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: LessonVideo; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."LessonVideo" (
    id text NOT NULL,
    "lessonId" text NOT NULL,
    "uploadedBy" text NOT NULL,
    title text NOT NULL,
    description text,
    "storageUrl" text NOT NULL,
    "thumbnailUrl" text,
    "durationSeconds" integer NOT NULL,
    "fileSize" integer NOT NULL,
    "uploadedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "isActive" boolean DEFAULT false NOT NULL,
    "thumbnailFile" text,
    status text DEFAULT 'PENDING'::text NOT NULL,
    "schoolId" text,
    "approvedBy" text,
    "approvedAt" timestamp(3) without time zone,
    "rejectedReason" text,
    "viewCount" integer DEFAULT 0 NOT NULL,
    "storageBytes" integer
);


--
-- Name: LongitudinalSnapshot; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."LongitudinalSnapshot" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    "schoolId" text NOT NULL,
    "studentId" text NOT NULL,
    subject public."Subject" NOT NULL,
    "strandKey" text,
    "periodStart" timestamp(3) without time zone NOT NULL,
    "periodType" text DEFAULT 'monthly'::text NOT NULL,
    score double precision NOT NULL,
    "growthRate" double precision DEFAULT 0 NOT NULL,
    classification text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: MasteryRecord; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."MasteryRecord" (
    id text NOT NULL,
    "studentId" text NOT NULL,
    "skillId" text NOT NULL,
    level integer DEFAULT 0 NOT NULL,
    "lastAssessedAt" timestamp(3) without time zone
);


--
-- Name: MasterySnapshot; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."MasterySnapshot" (
    id text NOT NULL,
    "studentId" text NOT NULL,
    "schoolId" text,
    subject text NOT NULL,
    "strandKey" text,
    "sourceProfileId" text,
    "sourceAttemptId" text,
    "currentScore" double precision,
    "baselineScore" double precision,
    "proficiencyState" text,
    "masteryState" text,
    "sustainabilityIndex" double precision,
    "decayRate" double precision,
    "aiRelianceRate" double precision,
    "hybridScore" double precision,
    "growthDelta" double precision,
    metadata jsonb,
    "capturedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "previousSnapshotId" text,
    "snapshotType" text DEFAULT 'progress_refresh'::text NOT NULL,
    "sourceEventId" text
);


--
-- Name: Meeting; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Meeting" (
    id text NOT NULL,
    "classId" text NOT NULL,
    "startsAt" timestamp(3) without time zone NOT NULL,
    "endsAt" timestamp(3) without time zone NOT NULL,
    subject text,
    "periodName" text,
    "jitsiRoomId" text,
    "joinUrl" text,
    "liveStatus" text DEFAULT 'SCHEDULED'::text NOT NULL,
    "startedAt" timestamp(3) without time zone,
    "endedAt" timestamp(3) without time zone,
    "hostUserId" text
);


--
-- Name: MeetingAttendee; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."MeetingAttendee" (
    id text NOT NULL,
    "meetingId" text NOT NULL,
    "userId" text NOT NULL,
    "joinedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Message; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Message" (
    id text NOT NULL,
    "classId" text,
    "fromUserId" text NOT NULL,
    "toUserId" text NOT NULL,
    body text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "senderRole" text DEFAULT 'GUARDIAN'::text NOT NULL,
    "recipientRole" text DEFAULT 'TEACHER'::text NOT NULL,
    "threadKey" text DEFAULT ''::text NOT NULL,
    read boolean DEFAULT false NOT NULL,
    "deletedBySender" boolean DEFAULT false NOT NULL,
    "deletedAt" timestamp(3) without time zone,
    flagged boolean DEFAULT false NOT NULL,
    "flagReason" text,
    "flaggedAt" timestamp(3) without time zone,
    "flagReviewedAt" timestamp(3) without time zone,
    "flagReviewedBy" text,
    "flagResolution" text,
    "attachmentUrl" text,
    "attachmentName" text,
    "attachmentType" text
);


--
-- Name: MessageReadReceipt; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."MessageReadReceipt" (
    id text NOT NULL,
    "messageId" text NOT NULL,
    "userId" text NOT NULL,
    "readAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: MetricEvent; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."MetricEvent" (
    id text NOT NULL,
    "schoolId" text,
    scope text NOT NULL,
    "scopeId" text,
    kind text NOT NULL,
    name text NOT NULL,
    severity text NOT NULL,
    "payloadJson" jsonb,
    "pilotOnly" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "userId" text
);


--
-- Name: MisconceptionCategory; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."MisconceptionCategory" (
    id text NOT NULL,
    "schoolId" text,
    subject text,
    "strandKey" text,
    code text NOT NULL,
    label text NOT NULL,
    description text,
    severity text,
    examples jsonb,
    guidance jsonb,
    "createdByUserId" text,
    "isSystem" boolean DEFAULT false NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: MisconceptionTag; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."MisconceptionTag" (
    id text NOT NULL,
    "studentId" text NOT NULL,
    "schoolId" text,
    "assessmentAttemptId" text,
    "interventionId" text,
    "chainId" text,
    "categoryId" text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    origin text DEFAULT 'assessment_evaluation'::text NOT NULL,
    confidence double precision,
    evidence jsonb,
    "teacherNote" text,
    "taggedByUserId" text,
    "sourceEventId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: MoeDirectiveApplication; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."MoeDirectiveApplication" (
    id text NOT NULL,
    "directiveId" text NOT NULL,
    "schoolId" text,
    "classId" text,
    grade integer,
    subject text,
    status text DEFAULT 'needs_review'::text NOT NULL,
    "appliedAt" timestamp(3) without time zone,
    "failureReason" text,
    evidence jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: MoePolicyDirective; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."MoePolicyDirective" (
    id text NOT NULL,
    title text NOT NULL,
    description text NOT NULL,
    "policyType" text NOT NULL,
    "targetScope" text NOT NULL,
    "targetFilters" jsonb NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    "createdById" text NOT NULL,
    "approvedById" text,
    "updatedById" text,
    "districtId" text,
    "schoolId" text,
    "publishedAt" timestamp(3) without time zone,
    "appliedAt" timestamp(3) without time zone,
    "rejectedAt" timestamp(3) without time zone,
    "archivedAt" timestamp(3) without time zone,
    "supersededById" text,
    "auditMetadata" jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: MoeSubmission; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."MoeSubmission" (
    id text NOT NULL,
    "schoolId" text NOT NULL,
    "schoolName" text NOT NULL,
    "submittedBy" text NOT NULL,
    type text NOT NULL,
    title text NOT NULL,
    description text,
    "fileUrl" text NOT NULL,
    "fileName" text NOT NULL,
    "fileSizeBytes" integer NOT NULL,
    status text DEFAULT 'SUBMITTED'::text NOT NULL,
    "moeNotes" text,
    "reviewedBy" text,
    "reviewedAt" timestamp(3) without time zone,
    "submittedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: NotificationInboxItem; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."NotificationInboxItem" (
    id text NOT NULL,
    "userId" text NOT NULL,
    title text NOT NULL,
    body text NOT NULL,
    url text,
    type text DEFAULT 'info'::text NOT NULL,
    "isRead" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: NotificationLog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."NotificationLog" (
    id text NOT NULL,
    "userId" text NOT NULL,
    channel text NOT NULL,
    recipient text NOT NULL,
    subject text,
    body text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    error text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: OfflinePack; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."OfflinePack" (
    id text NOT NULL,
    "requestedById" text NOT NULL,
    "classId" text,
    "studentId" text,
    "weekStart" timestamp(3) without time zone NOT NULL,
    "weekEnd" timestamp(3) without time zone NOT NULL,
    audience text DEFAULT 'student'::text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    "blobUrl" text,
    "blobKey" text,
    "sizeBytes" integer,
    "lessonCount" integer,
    "failureReason" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "completedAt" timestamp(3) without time zone,
    "expiresAt" timestamp(3) without time zone
);


--
-- Name: OperatorIncidentNote; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."OperatorIncidentNote" (
    id text NOT NULL,
    "workflowRunId" text NOT NULL,
    "noteType" text NOT NULL,
    severity text,
    status text DEFAULT 'OPEN'::text NOT NULL,
    body text NOT NULL,
    "createdByUserId" text NOT NULL,
    "schoolId" text,
    "tenantId" text,
    "resolvedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: OptimizationChangeRequest; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."OptimizationChangeRequest" (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    "proposalEventId" text NOT NULL,
    category text NOT NULL,
    title text NOT NULL,
    "affectedScope" text NOT NULL,
    "affectedArea" text NOT NULL,
    "schoolId" text,
    "districtId" text,
    "tenantId" text,
    "expectedImpact" text,
    "riskAssessment" jsonb,
    "evidenceRefs" jsonb,
    "proposedImplementationPlan" jsonb,
    "rollbackPlan" jsonb,
    "requiredReviewerRoles" jsonb,
    "workflowRunId" text,
    "workflowTraceId" text,
    "correlationId" text NOT NULL,
    status text DEFAULT 'DRAFT'::text NOT NULL,
    "implementationStatus" text DEFAULT 'NOT_STARTED'::text NOT NULL,
    "requiresManualImplementation" boolean DEFAULT true NOT NULL,
    "idempotencyKey" text,
    "createdBy" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "implementationOutcome" text
);


--
-- Name: Partner; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Partner" (
    id text NOT NULL,
    name text NOT NULL,
    kind text NOT NULL,
    website text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: PartnerContact; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PartnerContact" (
    id text NOT NULL,
    "partnerId" text NOT NULL,
    name text NOT NULL,
    email text,
    phone text
);


--
-- Name: PartnerProgram; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PartnerProgram" (
    id text NOT NULL,
    "partnerId" text NOT NULL,
    title text NOT NULL,
    description text,
    type text NOT NULL,
    active boolean DEFAULT true NOT NULL
);


--
-- Name: PasswordResetToken; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PasswordResetToken" (
    id text NOT NULL,
    token text NOT NULL,
    "userId" text NOT NULL,
    "expiresAt" timestamp(3) without time zone NOT NULL,
    "usedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "tokenHash" text,
    "adminCode" text
);


--
-- Name: PilotChecklistItem; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PilotChecklistItem" (
    id text NOT NULL,
    title text NOT NULL,
    description text,
    "sortOrder" integer DEFAULT 0 NOT NULL,
    active boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: PilotChecklistStatus; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PilotChecklistStatus" (
    id text NOT NULL,
    "schoolId" text NOT NULL,
    "itemId" text NOT NULL,
    "completedAt" timestamp(3) without time zone,
    "completedById" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: PipelineLock; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PipelineLock" (
    id text NOT NULL,
    "lockKey" text NOT NULL,
    owner text NOT NULL,
    "expiresAt" timestamp(3) without time zone NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: PlacementTest; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PlacementTest" (
    id text NOT NULL,
    "studentId" text NOT NULL,
    band text NOT NULL,
    "levelLabel" text NOT NULL,
    "estimatedGrade" integer NOT NULL,
    "rawScore" integer NOT NULL,
    "totalQuestions" integer NOT NULL,
    details jsonb,
    questions jsonb,
    answers jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "aiAnalysis" jsonb,
    "teacherDecision" text,
    "teacherGrade" integer,
    "teacherReason" text,
    "reviewedAt" timestamp(3) without time zone,
    "reviewedBy" text
);


--
-- Name: PlatformTransferToken; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PlatformTransferToken" (
    id text NOT NULL,
    token text NOT NULL,
    "createdBy" text NOT NULL,
    "expiresAt" timestamp(3) without time zone NOT NULL,
    "usedAt" timestamp(3) without time zone,
    "usedBy" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "intendedUserId" text,
    "tokenHash" text
);


--
-- Name: PortfolioCredential; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PortfolioCredential" (
    id text NOT NULL,
    "studentId" text NOT NULL,
    "verifyToken" text NOT NULL,
    term text NOT NULL,
    "schoolName" text NOT NULL,
    "studentName" text NOT NULL,
    grade text NOT NULL,
    "avgScore" double precision NOT NULL,
    attendance double precision NOT NULL,
    "lessonsComplete" integer NOT NULL,
    "blobUrl" text,
    "generatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "expiresAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: PortfolioItem; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PortfolioItem" (
    id text NOT NULL,
    "studentId" text NOT NULL,
    kind text NOT NULL,
    title text NOT NULL,
    url text,
    thumbnail text,
    meta jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "capstoneProjectId" text
);


--
-- Name: PortfolioShare; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PortfolioShare" (
    id text NOT NULL,
    "studentId" text NOT NULL,
    "shareCode" text NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: PostChangeEvaluationPlan; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PostChangeEvaluationPlan" (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    "changeRequestId" text NOT NULL,
    "baselineMetrics" jsonb,
    "postChangeMetrics" jsonb,
    "evaluationWindowDays" integer DEFAULT 14 NOT NULL,
    status text DEFAULT 'BASELINE_PENDING'::text NOT NULL,
    "detectorPrecisionBaseline" double precision,
    "falsePositiveRateBaseline" double precision,
    "recommendationAcceptanceBaseline" double precision,
    "approvalRejectionBaseline" double precision,
    findings jsonb,
    "feedbackLoopStatus" text DEFAULT 'pending'::text NOT NULL,
    "createdBy" text,
    "traceId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "overallOutcome" text,
    "confidenceScore" double precision,
    "evaluationWindowClosedAt" timestamp(3) without time zone
);


--
-- Name: PracticeItem; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PracticeItem" (
    id text NOT NULL,
    "skillId" text NOT NULL,
    stimulus text NOT NULL,
    "itemType" public."ItemType" NOT NULL,
    difficulty public."Difficulty" NOT NULL,
    "answerKey" jsonb,
    hints jsonb
);


--
-- Name: PushSubscription; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PushSubscription" (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    "userId" text NOT NULL,
    endpoint text NOT NULL,
    p256dh text NOT NULL,
    auth text NOT NULL,
    "deviceName" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "lastUsed" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: QuestionTag; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."QuestionTag" (
    id text NOT NULL,
    subject public."Subject" NOT NULL,
    "strandKey" text NOT NULL,
    difficulty public."Difficulty" NOT NULL,
    "itemType" public."ItemType" NOT NULL,
    "practiceItemId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: RagChunk; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."RagChunk" (
    id text NOT NULL,
    "sourceType" text NOT NULL,
    "sourceId" text NOT NULL,
    title text NOT NULL,
    content text NOT NULL,
    "chunkIndex" integer NOT NULL,
    subject text,
    grade integer,
    "schoolId" text,
    scope text NOT NULL,
    "sourceLabel" text,
    metadata jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "embeddedAt" timestamp(3) without time zone,
    embedding public.vector(1536)
);


--
-- Name: ReportCard; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ReportCard" (
    id text NOT NULL,
    "studentId" text NOT NULL,
    "termId" text NOT NULL,
    "schoolId" text NOT NULL,
    "classId" text NOT NULL,
    "subjectGrades" jsonb NOT NULL,
    "attendanceSummary" jsonb NOT NULL,
    "teacherComment" text,
    "principalComment" text,
    status text DEFAULT 'DRAFT'::text NOT NULL,
    "generatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "publishedAt" timestamp(3) without time zone,
    "createdBy" text NOT NULL
);


--
-- Name: ReportDraft; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ReportDraft" (
    id text NOT NULL,
    "agentName" text DEFAULT 'moe-narrative-report'::text NOT NULL,
    scope text NOT NULL,
    "scopeId" text,
    "periodType" text NOT NULL,
    "periodStart" timestamp(3) without time zone NOT NULL,
    "periodEnd" timestamp(3) without time zone NOT NULL,
    "narrativeText" text NOT NULL,
    "dataSnapshot" jsonb NOT NULL,
    "changesSummary" jsonb,
    status text DEFAULT 'DRAFT'::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: ReviewSchedule; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ReviewSchedule" (
    id text NOT NULL,
    "studentId" text NOT NULL,
    "skillId" text NOT NULL,
    "nextAt" timestamp(3) without time zone NOT NULL,
    "intervalDays" integer DEFAULT 7 NOT NULL
);


--
-- Name: SMSDeliveryLog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."SMSDeliveryLog" (
    id text NOT NULL,
    "schoolId" text NOT NULL,
    "studentId" text NOT NULL,
    "guardianId" text NOT NULL,
    "phoneE164" text NOT NULL,
    "messageType" public."SMSMessageType" NOT NULL,
    "templateKey" text,
    "payloadJson" jsonb,
    provider text NOT NULL,
    "providerMessageId" text,
    status public."SMSDeliveryStatus" DEFAULT 'queued'::public."SMSDeliveryStatus" NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    "lastError" text,
    "idempotencyKey" text NOT NULL,
    "pilotOnly" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: ScheduledWork; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ScheduledWork" (
    id text NOT NULL,
    "contentId" text NOT NULL,
    "classId" text NOT NULL,
    "scheduledDate" timestamp(3) without time zone NOT NULL,
    "createdById" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "endTime" text,
    "periodNumber" integer,
    "startTime" text,
    "classFormat" text,
    "deliveredAt" timestamp(3) without time zone,
    "deliveryNotes" text,
    "completionRate" integer,
    "isDelivered" boolean DEFAULT false NOT NULL,
    "sessionPairId" text,
    status text,
    "suggestedLabs" jsonb,
    "toolUsageLog" jsonb
);


--
-- Name: School; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."School" (
    id text NOT NULL,
    name text NOT NULL,
    timezone text DEFAULT 'Africa/Monrovia'::text NOT NULL,
    "primaryHex" text,
    "secondaryHex" text,
    "accentHex" text,
    "logoUrl" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "contactEmail" text,
    "contactName" text,
    "contactPhone" text,
    county text,
    district text,
    motto text,
    status text DEFAULT 'ACTIVE'::text NOT NULL,
    "welcomeMsg" text,
    "allowBlueprintAdoption" boolean DEFAULT true NOT NULL,
    "allowTeacherPublish" boolean DEFAULT false NOT NULL,
    "approvalRequired" boolean DEFAULT true NOT NULL,
    "onboardingStep" integer DEFAULT 0 NOT NULL,
    "pilotStatus" text,
    "pilotCohort" text,
    "pilotStartDate" timestamp(3) without time zone,
    "pilotNotes" text,
    "contactEmailVerified" boolean DEFAULT false NOT NULL,
    "contactPhoneVerified" boolean DEFAULT false NOT NULL,
    "districtId" text,
    code text,
    "schoolType" text,
    "estimatedEnrollment" integer,
    "approvedAt" timestamp(3) without time zone,
    "rejectedAt" timestamp(3) without time zone,
    "rejectionReason" text,
    "onboardingKitUrl" text,
    "onboardingKitStatus" text DEFAULT 'pending'::text NOT NULL,
    "onboardingGeneratedAt" timestamp(3) without time zone,
    "googleSsoEnabled" boolean DEFAULT true NOT NULL,
    "designatedSafetyStaffUserId" text
);


--
-- Name: SchoolEvent; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."SchoolEvent" (
    id text NOT NULL,
    "schoolId" text NOT NULL,
    title text NOT NULL,
    description text,
    "eventDate" timestamp(3) without time zone NOT NULL,
    "endDate" timestamp(3) without time zone,
    type text NOT NULL,
    visibility text DEFAULT 'ALL'::text NOT NULL,
    "sendSms" boolean DEFAULT false NOT NULL,
    "sendPush" boolean DEFAULT true NOT NULL,
    published boolean DEFAULT false NOT NULL,
    "createdBy" text NOT NULL,
    "smsScheduledAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: SchoolOnboarding; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."SchoolOnboarding" (
    id text NOT NULL,
    "schoolId" text NOT NULL,
    step integer DEFAULT 1 NOT NULL,
    completed boolean DEFAULT false NOT NULL,
    "completedAt" timestamp(3) without time zone,
    metadata jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: SchoolStorageQuota; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."SchoolStorageQuota" (
    id text NOT NULL,
    "schoolId" text NOT NULL,
    "usedBytes" bigint DEFAULT 0 NOT NULL,
    "limitBytes" bigint DEFAULT '5368709120'::bigint NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Session; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Session" (
    id text NOT NULL,
    "sessionToken" text NOT NULL,
    "userId" text NOT NULL,
    expires timestamp(3) without time zone NOT NULL
);


--
-- Name: Skill; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Skill" (
    id text NOT NULL,
    subject public."Subject" NOT NULL,
    band public."GradeBand" NOT NULL,
    descriptor text NOT NULL,
    examples jsonb
);


--
-- Name: SloEvent; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."SloEvent" (
    id text NOT NULL,
    service text NOT NULL,
    success boolean NOT NULL,
    "latencyMs" integer NOT NULL,
    "schoolId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: SmsResponse; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."SmsResponse" (
    id text NOT NULL,
    "sessionId" text NOT NULL,
    "questionIdx" integer NOT NULL,
    answer text NOT NULL,
    correct boolean NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: SmsSession; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."SmsSession" (
    id text NOT NULL,
    "assignmentId" text NOT NULL,
    "studentPhone" text NOT NULL,
    "studentId" text,
    questions jsonb NOT NULL,
    "currentIndex" integer DEFAULT 0 NOT NULL,
    score integer DEFAULT 0 NOT NULL,
    status text DEFAULT 'ACTIVE'::text NOT NULL,
    "expiresAt" timestamp(3) without time zone NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: StagedRolloutPlan; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."StagedRolloutPlan" (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    "changeRequestId" text NOT NULL,
    "currentStage" text DEFAULT 'INTERNAL_ONLY'::text NOT NULL,
    stages jsonb NOT NULL,
    status text DEFAULT 'DRAFT'::text NOT NULL,
    "requiresManualImplementation" boolean DEFAULT true NOT NULL,
    "rollbackTrigger" text,
    "rollbackOwner" text,
    "rollbackSteps" jsonb,
    "rollbackVerificationChecklist" jsonb,
    "expectedRestoredState" jsonb,
    "rolloutVerification" jsonb,
    "rollbackVerification" jsonb,
    "traceId" text,
    "createdBy" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Standard; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Standard" (
    id text NOT NULL,
    code text NOT NULL,
    description text NOT NULL,
    subject public."Subject" NOT NULL,
    band public."GradeBand" NOT NULL
);


--
-- Name: StrandCatalog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."StrandCatalog" (
    id text NOT NULL,
    subject public."Subject" NOT NULL,
    "strandKey" text NOT NULL,
    name text NOT NULL,
    "gradeBand" public."GradeBand" NOT NULL,
    "waecRef" text,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: StuckEvent; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."StuckEvent" (
    id text NOT NULL,
    "studentId" text NOT NULL,
    "lessonId" text NOT NULL,
    "sessionId" text,
    signal text NOT NULL,
    detail jsonb,
    "routedTo" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Student; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Student" (
    id text NOT NULL,
    "userId" text NOT NULL,
    county text,
    community text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "currentGrade" integer,
    "deletedAt" timestamp(3) without time zone,
    "dateOfBirth" timestamp(3) without time zone,
    "humanReadableStudentId" text
);


--
-- Name: StudentAdaptiveAttempt; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."StudentAdaptiveAttempt" (
    id text NOT NULL,
    "studentId" text NOT NULL,
    "strandCode" text NOT NULL,
    subject text NOT NULL,
    grade integer NOT NULL,
    score double precision NOT NULL,
    "difficultyTier" text NOT NULL,
    "completedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: StudentBadgeAward; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."StudentBadgeAward" (
    id text NOT NULL,
    "schoolId" text,
    "studentId" text NOT NULL,
    "badgeKey" text NOT NULL,
    title text NOT NULL,
    description text NOT NULL,
    "evidenceType" text NOT NULL,
    "evidenceId" text,
    "evidenceSummary" jsonb,
    "awardedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "criteriaVersion" text DEFAULT 'v1'::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: StudentGuardian; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."StudentGuardian" (
    id text NOT NULL,
    "studentId" text NOT NULL,
    "guardianId" text NOT NULL,
    relation text
);


--
-- Name: StudentImportBatch; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."StudentImportBatch" (
    id text NOT NULL,
    "schoolId" text NOT NULL,
    "createdById" text NOT NULL,
    status public."StudentImportBatchStatus" DEFAULT 'PENDING'::public."StudentImportBatchStatus" NOT NULL,
    "sourceFileName" text,
    "totalRows" integer DEFAULT 0 NOT NULL,
    "processedRows" integer DEFAULT 0 NOT NULL,
    "successCount" integer DEFAULT 0 NOT NULL,
    "errorCount" integer DEFAULT 0 NOT NULL,
    "queuedAt" timestamp(3) without time zone,
    "completedAt" timestamp(3) without time zone,
    "downloadedAt" timestamp(3) without time zone,
    "resultSummary" jsonb,
    "credentialCsv" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: StudentMasteryProfile; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."StudentMasteryProfile" (
    id text NOT NULL,
    "studentId" text NOT NULL,
    subject public."Subject" NOT NULL,
    "strandKey" text NOT NULL,
    "baselineScore" double precision DEFAULT 0 NOT NULL,
    "currentScore" double precision DEFAULT 0 NOT NULL,
    "proficiencyState" public."ProficiencyState" DEFAULT 'NOT_ASSESSED'::public."ProficiencyState" NOT NULL,
    "masteryState" public."MasteryState" DEFAULT 'NOT_ASSESSED'::public."MasteryState" NOT NULL,
    "sustainabilityIndex" double precision DEFAULT 0 NOT NULL,
    "decayRate" double precision DEFAULT 0 NOT NULL,
    "aiRelianceRate" double precision DEFAULT 0 NOT NULL,
    "lastAssessedAt" timestamp(3) without time zone,
    "baselineConfidence" double precision,
    "baselineCompletedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: StudentPerformanceEvent; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."StudentPerformanceEvent" (
    id text NOT NULL,
    "studentId" text NOT NULL,
    "lessonId" text,
    subject text NOT NULL,
    "gradeLevel" integer NOT NULL,
    "eventType" text NOT NULL,
    score double precision NOT NULL,
    "durationSeconds" integer NOT NULL,
    attempts integer DEFAULT 1 NOT NULL,
    "aiAssistUsed" boolean DEFAULT false NOT NULL,
    "schoolId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: StudentProgress; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."StudentProgress" (
    id text NOT NULL,
    "studentId" text NOT NULL,
    "scheduledWorkId" text NOT NULL,
    "completedAt" timestamp(3) without time zone,
    "startedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "exitTicketResponses" jsonb,
    "exitTicketScore" integer
);


--
-- Name: StudentSession; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."StudentSession" (
    id text NOT NULL,
    "studentId" text NOT NULL,
    "lessonId" text NOT NULL,
    "startedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "endedAt" timestamp(3) without time zone,
    "totalMs" integer DEFAULT 0 NOT NULL,
    "questionsAttempted" integer DEFAULT 0 NOT NULL,
    "questionsCorrect" integer DEFAULT 0 NOT NULL,
    "stuckEventCount" integer DEFAULT 0 NOT NULL
);


--
-- Name: StudentStreak; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."StudentStreak" (
    id text NOT NULL,
    "studentId" text NOT NULL,
    "currentStreak" integer DEFAULT 0 NOT NULL,
    "longestStreak" integer DEFAULT 0 NOT NULL,
    "lastActiveDate" timestamp(3) without time zone,
    "optOut" boolean DEFAULT false NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Submission; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Submission" (
    id text NOT NULL,
    "assessmentId" text NOT NULL,
    "studentId" text NOT NULL,
    responses jsonb NOT NULL,
    score integer,
    "gradedAt" timestamp(3) without time zone
);


--
-- Name: SystemEvent; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."SystemEvent" (
    id text NOT NULL,
    "eventType" text NOT NULL,
    severity text NOT NULL,
    source text NOT NULL,
    message text NOT NULL,
    metadata jsonb,
    "resolvedBy" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "resolvedAt" timestamp(3) without time zone
);


--
-- Name: TeacherAction; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."TeacherAction" (
    id text NOT NULL,
    "teacherUserId" text NOT NULL,
    "schoolId" text NOT NULL,
    "classId" text,
    "studentId" text,
    "contentId" text,
    "actionType" text NOT NULL,
    "targetType" text,
    "targetId" text,
    subject text,
    metadata jsonb,
    "occurredAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: TeacherAlert; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."TeacherAlert" (
    id text NOT NULL,
    "teacherUserId" text NOT NULL,
    "schoolId" text NOT NULL,
    "studentId" text,
    "alertType" text NOT NULL,
    severity text DEFAULT 'medium'::text NOT NULL,
    reason text NOT NULL,
    "weakConcept" text,
    "weakLesson" text,
    "recommendedAction" text,
    "idempotencyKey" text,
    status text DEFAULT 'ACTIVE'::text NOT NULL,
    "reviewedAt" timestamp(3) without time zone,
    "reviewedByUserId" text,
    "dismissedAt" timestamp(3) without time zone,
    "dismissReason" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: TeacherAlertPreference; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."TeacherAlertPreference" (
    id text NOT NULL,
    "teacherId" text NOT NULL,
    "alertLowGrade" boolean DEFAULT true NOT NULL,
    "alertInactive" boolean DEFAULT true NOT NULL,
    "alertNewSubmission" boolean DEFAULT true NOT NULL,
    "alertGuardianMessage" boolean DEFAULT true NOT NULL,
    "dailyDigest" boolean DEFAULT false NOT NULL,
    "digestHour" integer DEFAULT 7 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: TeacherAssignment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."TeacherAssignment" (
    id text NOT NULL,
    "schoolId" text NOT NULL,
    "teacherId" text NOT NULL,
    "classId" text NOT NULL,
    "isPrimary" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    subject public."Subject" NOT NULL
);


--
-- Name: TeacherLessonAssignment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."TeacherLessonAssignment" (
    id text NOT NULL,
    "contentId" text NOT NULL,
    "classId" text NOT NULL,
    "assignedById" text NOT NULL,
    "scheduledFor" timestamp with time zone,
    "assignedAt" timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TeacherMorningBrief; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."TeacherMorningBrief" (
    id text NOT NULL,
    "agentName" text DEFAULT 'morning-brief'::text NOT NULL,
    "teacherUserId" text NOT NULL,
    "schoolId" text NOT NULL,
    "briefDate" timestamp(3) without time zone NOT NULL,
    "briefText" text NOT NULL,
    "dataSnapshot" jsonb NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: TeacherProfile; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."TeacherProfile" (
    id text NOT NULL,
    "userId" text NOT NULL,
    "schoolId" text NOT NULL,
    "fullName" text NOT NULL,
    phone text,
    permissions jsonb,
    "gradesTaught" public."GradeBand"[],
    "subjectsTaught" public."Subject"[],
    "isOnboarded" boolean DEFAULT false NOT NULL,
    "onboardedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: TeacherSentiment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."TeacherSentiment" (
    id text NOT NULL,
    "teacherId" text NOT NULL,
    "schoolId" text NOT NULL,
    rating text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: TeachingLedger; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."TeachingLedger" (
    id text NOT NULL,
    "sessionId" text NOT NULL,
    "contentId" text NOT NULL,
    "facilitatorId" text NOT NULL,
    "schoolId" text NOT NULL,
    grade text NOT NULL,
    subject text NOT NULL,
    "standardsCovered" jsonb NOT NULL,
    objectives jsonb NOT NULL,
    "resourcesUsed" jsonb NOT NULL,
    "questionsAsked" jsonb NOT NULL,
    "aggregatedResponses" jsonb NOT NULL,
    "quizResults" jsonb,
    "homeworkAssigned" jsonb,
    transcript jsonb NOT NULL,
    "confidenceFlags" jsonb NOT NULL,
    "outOfScopeQuestions" jsonb NOT NULL,
    "facilitatorNotes" text,
    "narrativeText" text,
    status text DEFAULT 'DRAFT'::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: TeachingSession; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."TeachingSession" (
    id text NOT NULL,
    "contentId" text NOT NULL,
    "facilitatorId" text NOT NULL,
    "schoolId" text NOT NULL,
    grade text NOT NULL,
    subject text NOT NULL,
    "alignmentMode" text NOT NULL,
    status text DEFAULT 'ACTIVE'::text NOT NULL,
    "degradedMode" text,
    "startedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "endedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "nextTurnIndex" integer DEFAULT 0 NOT NULL
);


--
-- Name: TeachingTurn; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."TeachingTurn" (
    id text NOT NULL,
    "sessionId" text NOT NULL,
    "turnIndex" integer NOT NULL,
    role text NOT NULL,
    "inputText" text NOT NULL,
    "responseText" text NOT NULL,
    "guardrailMode" text NOT NULL,
    deferred boolean DEFAULT false NOT NULL,
    "lessonDirectorAction" text NOT NULL,
    "whisperPrompt" jsonb,
    "llmCostUSD" double precision DEFAULT 0 NOT NULL,
    "latencyMs" integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Term; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Term" (
    id text NOT NULL,
    "academicYearId" text NOT NULL,
    name text NOT NULL,
    "startDate" timestamp(3) without time zone NOT NULL,
    "endDate" timestamp(3) without time zone NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: TextbookGenerationJob; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."TextbookGenerationJob" (
    id text NOT NULL,
    grade integer NOT NULL,
    subject text NOT NULL,
    format text DEFAULT 'student'::text NOT NULL,
    version text DEFAULT 'v1'::text NOT NULL,
    status text DEFAULT 'PENDING'::text NOT NULL,
    "storageUrl" text,
    "storagePath" text,
    "estimatedCostUsd" double precision DEFAULT 0 NOT NULL,
    "durationMs" integer,
    "errorMessage" text,
    attempts integer DEFAULT 0 NOT NULL,
    force boolean DEFAULT false NOT NULL,
    "requestedById" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "claimedAt" timestamp(3) without time zone,
    "generatedAt" timestamp(3) without time zone
);


--
-- Name: Timetable; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Timetable" (
    id text NOT NULL,
    "schoolId" text NOT NULL,
    "classId" text NOT NULL,
    "teacherId" text NOT NULL,
    "dayOfWeek" public."Weekday" NOT NULL,
    "periodLabel" text NOT NULL,
    "startTime" text,
    "endTime" text,
    room text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    subject public."Subject" NOT NULL
);


--
-- Name: TimetableAssignment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."TimetableAssignment" (
    id text NOT NULL,
    "timetableId" text NOT NULL,
    "curriculumContentId" text,
    "assignedById" text NOT NULL,
    "assignedDate" date NOT NULL,
    title text NOT NULL,
    instructions text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: TrainingModule; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."TrainingModule" (
    id text NOT NULL,
    title text NOT NULL,
    description text,
    content text,
    "sortOrder" integer DEFAULT 0 NOT NULL,
    "estimatedMinutes" integer DEFAULT 0 NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    code text
);


--
-- Name: TrainingProgress; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."TrainingProgress" (
    id text NOT NULL,
    "teacherUserId" text NOT NULL,
    "moduleId" text NOT NULL,
    status public."TrainingStatus" DEFAULT 'not_started'::public."TrainingStatus" NOT NULL,
    "startedAt" timestamp(3) without time zone,
    "completedAt" timestamp(3) without time zone,
    "completionEvidence" jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Transcript; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Transcript" (
    id text NOT NULL,
    "studentId" text NOT NULL,
    "schoolId" text NOT NULL,
    "academicYearId" text NOT NULL,
    grade integer NOT NULL,
    gpa double precision,
    summary jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: TrendSnapshot; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."TrendSnapshot" (
    id text NOT NULL,
    scope text NOT NULL,
    "scopeKey" text,
    bucket text NOT NULL,
    metrics jsonb NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: TutorConversation; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."TutorConversation" (
    id text NOT NULL,
    "studentId" text NOT NULL,
    "contentId" text NOT NULL,
    "schoolId" text NOT NULL,
    messages jsonb NOT NULL,
    "questionsAsked" integer DEFAULT 0 NOT NULL,
    "sessionDate" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Unit; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Unit" (
    id text NOT NULL,
    "standardId" text,
    subject public."Subject" NOT NULL,
    band public."GradeBand" NOT NULL,
    title text NOT NULL,
    weeks integer DEFAULT 2 NOT NULL
);


--
-- Name: User; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."User" (
    id text NOT NULL,
    email text NOT NULL,
    "emailVerified" timestamp(3) without time zone,
    "hashedPwd" text,
    name text,
    role public."Role" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "schoolId" text,
    "isPlatformAdmin" boolean DEFAULT false NOT NULL,
    "guardianCountryCode" text DEFAULT '+231'::text NOT NULL,
    "guardianPhone" text,
    "guardianPhoneE164" text,
    "preferredChannel" text DEFAULT 'EMAIL'::text NOT NULL,
    "smsOptIn" boolean DEFAULT false NOT NULL,
    "passwordChangedAt" timestamp(3) without time zone,
    "mustChangePIN" boolean DEFAULT false NOT NULL,
    "loginId" text,
    "guardianSmsPreferences" jsonb,
    "welcomeCompletedAt" timestamp(3) without time zone,
    "teacherWelcomeCompletedAt" timestamp(3) without time zone,
    "languagePreference" text DEFAULT 'en'::text,
    "googleId" text,
    "tourCompletedAt" timestamp(3) without time zone,
    "privacyAcceptedAt" timestamp(3) without time zone,
    phone text
);


--
-- Name: VerificationToken; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."VerificationToken" (
    identifier text NOT NULL,
    token text NOT NULL,
    expires timestamp(3) without time zone NOT NULL
);


--
-- Name: VideoWatchEvent; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."VideoWatchEvent" (
    id text NOT NULL,
    "videoId" text NOT NULL,
    "studentId" text NOT NULL,
    "watchedSecs" integer NOT NULL,
    "totalSecs" integer NOT NULL,
    "completedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: VirtualLab; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."VirtualLab" (
    id text NOT NULL,
    "labId" text NOT NULL,
    title text NOT NULL,
    description text NOT NULL,
    subject text NOT NULL,
    grade integer NOT NULL,
    "gradeBand" text NOT NULL,
    "labType" text NOT NULL,
    "moeStandardCodes" text[] DEFAULT '{}'::text[] NOT NULL,
    "primaryContentIds" text[] DEFAULT '{}'::text[] NOT NULL,
    "triggerStandardCodes" text[] DEFAULT '{}'::text[] NOT NULL,
    "estimatedMinutes" integer NOT NULL,
    difficulty text NOT NULL,
    "equipmentList" text[] DEFAULT '{}'::text[] NOT NULL,
    "safetyNotes" text,
    payload jsonb NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    "schoolId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: WaecPracticeItem; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."WaecPracticeItem" (
    id text NOT NULL,
    "subjectId" text NOT NULL,
    "topicId" text NOT NULL,
    prompt text NOT NULL,
    options jsonb NOT NULL,
    "correctIndex" integer NOT NULL,
    explanation text,
    grade integer DEFAULT 11 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: WeeklyLeaderboard; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."WeeklyLeaderboard" (
    id text NOT NULL,
    "classId" text NOT NULL,
    "schoolId" text NOT NULL,
    "weekStart" timestamp(3) without time zone NOT NULL,
    entries jsonb NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: WorkflowCheckpoint; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."WorkflowCheckpoint" (
    id text NOT NULL,
    "workflowRunId" text NOT NULL,
    "checkpointKey" text NOT NULL,
    status text DEFAULT 'recorded'::text NOT NULL,
    sequence integer NOT NULL,
    "actorType" text,
    "actorId" text,
    "workerId" text,
    "traceId" text,
    "idempotencyKey" text,
    state jsonb,
    "evidenceRefs" jsonb,
    "executionMetadata" jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: WorkflowRun; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."WorkflowRun" (
    id text NOT NULL,
    "workflowType" text NOT NULL,
    "tenantId" text,
    "schoolId" text,
    "districtId" text,
    "partitionKey" text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    "riskLevel" text DEFAULT 'low'::text NOT NULL,
    "traceId" text NOT NULL,
    "correlationId" text NOT NULL,
    "idempotencyKey" text,
    "triggerEventId" text,
    "replayOfRunId" text,
    "isReplay" boolean DEFAULT false NOT NULL,
    "replayMode" text DEFAULT 'analysis_only'::text NOT NULL,
    "replaySequence" integer,
    source text,
    "targetType" text,
    "targetId" text,
    "currentCheckpoint" text,
    "approvalRequired" boolean DEFAULT false NOT NULL,
    "approvalRequestId" text,
    attempt integer DEFAULT 0 NOT NULL,
    "maxAttempts" integer DEFAULT 3 NOT NULL,
    "nextRetryAt" timestamp(3) without time zone,
    "lockedBy" text,
    "lockedUntil" timestamp(3) without time zone,
    "lastErrorCode" text,
    "lastErrorMessage" text,
    "evidenceRefs" jsonb,
    "queueMetadata" jsonb,
    "executionMetadata" jsonb,
    "tracingMetadata" jsonb,
    "startedAt" timestamp(3) without time zone,
    "completedAt" timestamp(3) without time zone,
    "cancelledAt" timestamp(3) without time zone,
    "deadLetteredAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    version integer DEFAULT 1 NOT NULL
);


--
-- Name: WorkflowStep; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."WorkflowStep" (
    id text NOT NULL,
    "workflowRunId" text NOT NULL,
    "stepKey" text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    sequence integer DEFAULT 0 NOT NULL,
    attempt integer DEFAULT 0 NOT NULL,
    "maxAttempts" integer DEFAULT 3 NOT NULL,
    "idempotencyKey" text,
    "traceId" text,
    "startedAt" timestamp(3) without time zone,
    "completedAt" timestamp(3) without time zone,
    "nextRetryAt" timestamp(3) without time zone,
    "lastErrorCode" text,
    "lastErrorMessage" text,
    "inputRefs" jsonb,
    "outputRefs" jsonb,
    "executionMetadata" jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: _SkillToStandard; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."_SkillToStandard" (
    "A" text NOT NULL,
    "B" text NOT NULL
);


--
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


--
-- Name: AIInteraction AIInteraction_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AIInteraction"
    ADD CONSTRAINT "AIInteraction_pkey" PRIMARY KEY (id);


--
-- Name: AILiteracyExercise AILiteracyExercise_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AILiteracyExercise"
    ADD CONSTRAINT "AILiteracyExercise_pkey" PRIMARY KEY (id);


--
-- Name: AcademicEnrollment AcademicEnrollment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AcademicEnrollment"
    ADD CONSTRAINT "AcademicEnrollment_pkey" PRIMARY KEY (id);


--
-- Name: AcademicYear AcademicYear_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AcademicYear"
    ADD CONSTRAINT "AcademicYear_pkey" PRIMARY KEY (id);


--
-- Name: Account Account_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Account"
    ADD CONSTRAINT "Account_pkey" PRIMARY KEY (id);


--
-- Name: ActionExecution ActionExecution_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ActionExecution"
    ADD CONSTRAINT "ActionExecution_pkey" PRIMARY KEY (id);


--
-- Name: AdaptiveMasteryRecord AdaptiveMasteryRecord_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AdaptiveMasteryRecord"
    ADD CONSTRAINT "AdaptiveMasteryRecord_pkey" PRIMARY KEY (id);


--
-- Name: AdaptiveMasteryRecord AdaptiveMasteryRecord_studentId_skillKey_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AdaptiveMasteryRecord"
    ADD CONSTRAINT "AdaptiveMasteryRecord_studentId_skillKey_key" UNIQUE ("studentId", "skillKey");


--
-- Name: AgentControl AgentControl_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AgentControl"
    ADD CONSTRAINT "AgentControl_pkey" PRIMARY KEY (id);


--
-- Name: AgentCostAccounting AgentCostAccounting_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AgentCostAccounting"
    ADD CONSTRAINT "AgentCostAccounting_pkey" PRIMARY KEY (id);


--
-- Name: AgentDecision AgentDecision_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AgentDecision"
    ADD CONSTRAINT "AgentDecision_pkey" PRIMARY KEY (id);


--
-- Name: AgentGoal AgentGoal_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AgentGoal"
    ADD CONSTRAINT "AgentGoal_pkey" PRIMARY KEY (id);


--
-- Name: AgentInvocation AgentInvocation_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AgentInvocation"
    ADD CONSTRAINT "AgentInvocation_pkey" PRIMARY KEY (id);


--
-- Name: AgentMetric AgentMetric_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AgentMetric"
    ADD CONSTRAINT "AgentMetric_pkey" PRIMARY KEY (id);


--
-- Name: AgentRun AgentRun_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AgentRun"
    ADD CONSTRAINT "AgentRun_pkey" PRIMARY KEY (id);


--
-- Name: AgentTask AgentTask_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AgentTask"
    ADD CONSTRAINT "AgentTask_pkey" PRIMARY KEY (id);


--
-- Name: Agent Agent_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Agent"
    ADD CONSTRAINT "Agent_pkey" PRIMARY KEY (id);


--
-- Name: AiInteractionLog AiInteractionLog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AiInteractionLog"
    ADD CONSTRAINT "AiInteractionLog_pkey" PRIMARY KEY (id);


--
-- Name: Announcement Announcement_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Announcement"
    ADD CONSTRAINT "Announcement_pkey" PRIMARY KEY (id);


--
-- Name: ApprovalRequest ApprovalRequest_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ApprovalRequest"
    ADD CONSTRAINT "ApprovalRequest_pkey" PRIMARY KEY (id);


--
-- Name: AssessmentAttemptDetail AssessmentAttemptDetail_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AssessmentAttemptDetail"
    ADD CONSTRAINT "AssessmentAttemptDetail_pkey" PRIMARY KEY (id);


--
-- Name: AssessmentAttempt AssessmentAttempt_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AssessmentAttempt"
    ADD CONSTRAINT "AssessmentAttempt_pkey" PRIMARY KEY (id);


--
-- Name: AssessmentItem AssessmentItem_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AssessmentItem"
    ADD CONSTRAINT "AssessmentItem_pkey" PRIMARY KEY (id);


--
-- Name: Assessment Assessment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Assessment"
    ADD CONSTRAINT "Assessment_pkey" PRIMARY KEY (id);


--
-- Name: AssignmentSubmission AssignmentSubmission_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AssignmentSubmission"
    ADD CONSTRAINT "AssignmentSubmission_pkey" PRIMARY KEY (id);


--
-- Name: AssignmentSuggestion AssignmentSuggestion_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AssignmentSuggestion"
    ADD CONSTRAINT "AssignmentSuggestion_pkey" PRIMARY KEY (id);


--
-- Name: Assignment Assignment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Assignment"
    ADD CONSTRAINT "Assignment_pkey" PRIMARY KEY (id);


--
-- Name: AttendanceRecord AttendanceRecord_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AttendanceRecord"
    ADD CONSTRAINT "AttendanceRecord_pkey" PRIMARY KEY (id);


--
-- Name: Attendance Attendance_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Attendance"
    ADD CONSTRAINT "Attendance_pkey" PRIMARY KEY (id);


--
-- Name: AuditLog AuditLog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AuditLog"
    ADD CONSTRAINT "AuditLog_pkey" PRIMARY KEY (id);


--
-- Name: BlockScheduleTemplate BlockScheduleTemplate_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BlockScheduleTemplate"
    ADD CONSTRAINT "BlockScheduleTemplate_pkey" PRIMARY KEY (id);


--
-- Name: CanvaOAuthCredential CanvaOAuthCredential_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CanvaOAuthCredential"
    ADD CONSTRAINT "CanvaOAuthCredential_pkey" PRIMARY KEY (id);


--
-- Name: CanvaOAuthState CanvaOAuthState_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CanvaOAuthState"
    ADD CONSTRAINT "CanvaOAuthState_pkey" PRIMARY KEY (id);


--
-- Name: CapstoneProject CapstoneProject_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CapstoneProject"
    ADD CONSTRAINT "CapstoneProject_pkey" PRIMARY KEY (id);


--
-- Name: CertificateShare CertificateShare_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CertificateShare"
    ADD CONSTRAINT "CertificateShare_pkey" PRIMARY KEY (id);


--
-- Name: Certificate Certificate_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Certificate"
    ADD CONSTRAINT "Certificate_pkey" PRIMARY KEY (id);


--
-- Name: ChangeRequestSignoff ChangeRequestSignoff_idempotencyKey_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ChangeRequestSignoff"
    ADD CONSTRAINT "ChangeRequestSignoff_idempotencyKey_key" UNIQUE ("idempotencyKey");


--
-- Name: ChangeRequestSignoff ChangeRequestSignoff_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ChangeRequestSignoff"
    ADD CONSTRAINT "ChangeRequestSignoff_pkey" PRIMARY KEY (id);


--
-- Name: ChatMessage ChatMessage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ChatMessage"
    ADD CONSTRAINT "ChatMessage_pkey" PRIMARY KEY (id);


--
-- Name: Class Class_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Class"
    ADD CONSTRAINT "Class_pkey" PRIMARY KEY (id);


--
-- Name: CodeExercise CodeExercise_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CodeExercise"
    ADD CONSTRAINT "CodeExercise_pkey" PRIMARY KEY (id);


--
-- Name: ConfusionSignal ConfusionSignal_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ConfusionSignal"
    ADD CONSTRAINT "ConfusionSignal_pkey" PRIMARY KEY (id);


--
-- Name: ConsentRecord ConsentRecord_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ConsentRecord"
    ADD CONSTRAINT "ConsentRecord_pkey" PRIMARY KEY (id);


--
-- Name: ContentQaReview ContentQaReview_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ContentQaReview"
    ADD CONSTRAINT "ContentQaReview_pkey" PRIMARY KEY (id);


--
-- Name: CurriculumContent CurriculumContent_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CurriculumContent"
    ADD CONSTRAINT "CurriculumContent_pkey" PRIMARY KEY (id);


--
-- Name: CurriculumFeedback CurriculumFeedback_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CurriculumFeedback"
    ADD CONSTRAINT "CurriculumFeedback_pkey" PRIMARY KEY (id);


--
-- Name: CurriculumFlag CurriculumFlag_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CurriculumFlag"
    ADD CONSTRAINT "CurriculumFlag_pkey" PRIMARY KEY (id);


--
-- Name: CurriculumLessonPlan CurriculumLessonPlan_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CurriculumLessonPlan"
    ADD CONSTRAINT "CurriculumLessonPlan_pkey" PRIMARY KEY (id);


--
-- Name: CurriculumRegenerationCheckpoint CurriculumRegenerationCheckpoint_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CurriculumRegenerationCheckpoint"
    ADD CONSTRAINT "CurriculumRegenerationCheckpoint_pkey" PRIMARY KEY (id);


--
-- Name: CurriculumRegenerationJob CurriculumRegenerationJob_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CurriculumRegenerationJob"
    ADD CONSTRAINT "CurriculumRegenerationJob_pkey" PRIMARY KEY (id);


--
-- Name: CurriculumRegenerationRun CurriculumRegenerationRun_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CurriculumRegenerationRun"
    ADD CONSTRAINT "CurriculumRegenerationRun_pkey" PRIMARY KEY (id);


--
-- Name: CurriculumUnit CurriculumUnit_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CurriculumUnit"
    ADD CONSTRAINT "CurriculumUnit_pkey" PRIMARY KEY (id);


--
-- Name: CurriculumUnit CurriculumUnit_unitId_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CurriculumUnit"
    ADD CONSTRAINT "CurriculumUnit_unitId_key" UNIQUE ("unitId");


--
-- Name: CurriculumVersion CurriculumVersion_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CurriculumVersion"
    ADD CONSTRAINT "CurriculumVersion_pkey" PRIMARY KEY (id);


--
-- Name: CurriculumWeek CurriculumWeek_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CurriculumWeek"
    ADD CONSTRAINT "CurriculumWeek_pkey" PRIMARY KEY (id);


--
-- Name: DataAccessLog DataAccessLog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DataAccessLog"
    ADD CONSTRAINT "DataAccessLog_pkey" PRIMARY KEY (id);


--
-- Name: DataPolicyAcceptance DataPolicyAcceptance_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DataPolicyAcceptance"
    ADD CONSTRAINT "DataPolicyAcceptance_pkey" PRIMARY KEY (id);


--
-- Name: DerivedStudentProgress DerivedStudentProgress_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DerivedStudentProgress"
    ADD CONSTRAINT "DerivedStudentProgress_pkey" PRIMARY KEY (id);


--
-- Name: DiscussionLastRead DiscussionLastRead_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DiscussionLastRead"
    ADD CONSTRAINT "DiscussionLastRead_pkey" PRIMARY KEY (id);


--
-- Name: DiscussionPost DiscussionPost_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DiscussionPost"
    ADD CONSTRAINT "DiscussionPost_pkey" PRIMARY KEY (id);


--
-- Name: DiscussionThread DiscussionThread_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DiscussionThread"
    ADD CONSTRAINT "DiscussionThread_pkey" PRIMARY KEY (id);


--
-- Name: DiscussionUpvote DiscussionUpvote_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DiscussionUpvote"
    ADD CONSTRAINT "DiscussionUpvote_pkey" PRIMARY KEY (id);


--
-- Name: DistrictUpdateDraft DistrictUpdateDraft_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DistrictUpdateDraft"
    ADD CONSTRAINT "DistrictUpdateDraft_pkey" PRIMARY KEY (id);


--
-- Name: District District_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."District"
    ADD CONSTRAINT "District_pkey" PRIMARY KEY (id);


--
-- Name: Enrollment Enrollment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Enrollment"
    ADD CONSTRAINT "Enrollment_pkey" PRIMARY KEY (id);


--
-- Name: EscalationQueue EscalationQueue_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."EscalationQueue"
    ADD CONSTRAINT "EscalationQueue_pkey" PRIMARY KEY (id);


--
-- Name: EvalRun EvalRun_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."EvalRun"
    ADD CONSTRAINT "EvalRun_pkey" PRIMARY KEY (id);


--
-- Name: ExamAttempt ExamAttempt_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ExamAttempt"
    ADD CONSTRAINT "ExamAttempt_pkey" PRIMARY KEY (id);


--
-- Name: ExamCertification ExamCertification_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ExamCertification"
    ADD CONSTRAINT "ExamCertification_pkey" PRIMARY KEY (id);


--
-- Name: ExamQuestion ExamQuestion_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ExamQuestion"
    ADD CONSTRAINT "ExamQuestion_pkey" PRIMARY KEY (id);


--
-- Name: Exam Exam_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Exam"
    ADD CONSTRAINT "Exam_pkey" PRIMARY KEY (id);


--
-- Name: ExecutionTrace ExecutionTrace_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ExecutionTrace"
    ADD CONSTRAINT "ExecutionTrace_pkey" PRIMARY KEY (id);


--
-- Name: ExportJobRequest ExportJobRequest_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ExportJobRequest"
    ADD CONSTRAINT "ExportJobRequest_pkey" PRIMARY KEY (id);


--
-- Name: ExportRecord ExportRecord_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ExportRecord"
    ADD CONSTRAINT "ExportRecord_pkey" PRIMARY KEY (id);


--
-- Name: GeneratedDocument GeneratedDocument_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."GeneratedDocument"
    ADD CONSTRAINT "GeneratedDocument_pkey" PRIMARY KEY (id);


--
-- Name: GradePipelineJob GradePipelineJob_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."GradePipelineJob"
    ADD CONSTRAINT "GradePipelineJob_pkey" PRIMARY KEY (id);


--
-- Name: Grade Grade_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Grade"
    ADD CONSTRAINT "Grade_pkey" PRIMARY KEY (id);


--
-- Name: GradedSubmission GradedSubmission_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."GradedSubmission"
    ADD CONSTRAINT "GradedSubmission_pkey" PRIMARY KEY (id);


--
-- Name: GuardianConsent GuardianConsent_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."GuardianConsent"
    ADD CONSTRAINT "GuardianConsent_pkey" PRIMARY KEY (id);


--
-- Name: GuardianConversation GuardianConversation_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."GuardianConversation"
    ADD CONSTRAINT "GuardianConversation_pkey" PRIMARY KEY (id);


--
-- Name: GuardianMessage GuardianMessage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."GuardianMessage"
    ADD CONSTRAINT "GuardianMessage_pkey" PRIMARY KEY (id);


--
-- Name: GuardianSmsCostAccounting GuardianSmsCostAccounting_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."GuardianSmsCostAccounting"
    ADD CONSTRAINT "GuardianSmsCostAccounting_pkey" PRIMARY KEY (id);


--
-- Name: HomeworkSubmission HomeworkSubmission_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."HomeworkSubmission"
    ADD CONSTRAINT "HomeworkSubmission_pkey" PRIMARY KEY (id);


--
-- Name: Homework Homework_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Homework"
    ADD CONSTRAINT "Homework_pkey" PRIMARY KEY (id);


--
-- Name: ImpactSnapshot ImpactSnapshot_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ImpactSnapshot"
    ADD CONSTRAINT "ImpactSnapshot_pkey" PRIMARY KEY (id);


--
-- Name: InterventionChain InterventionChain_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."InterventionChain"
    ADD CONSTRAINT "InterventionChain_pkey" PRIMARY KEY (id);


--
-- Name: InterventionLog InterventionLog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."InterventionLog"
    ADD CONSTRAINT "InterventionLog_pkey" PRIMARY KEY (id);


--
-- Name: InterventionRecommendation InterventionRecommendation_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."InterventionRecommendation"
    ADD CONSTRAINT "InterventionRecommendation_pkey" PRIMARY KEY (id);


--
-- Name: Intervention Intervention_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Intervention"
    ADD CONSTRAINT "Intervention_pkey" PRIMARY KEY (id);


--
-- Name: InviteToken InviteToken_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."InviteToken"
    ADD CONSTRAINT "InviteToken_pkey" PRIMARY KEY (id);


--
-- Name: LabSession LabSession_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."LabSession"
    ADD CONSTRAINT "LabSession_pkey" PRIMARY KEY (id);


--
-- Name: LeagueSnapshot LeagueSnapshot_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."LeagueSnapshot"
    ADD CONSTRAINT "LeagueSnapshot_pkey" PRIMARY KEY (id);


--
-- Name: LeagueSnapshot LeagueSnapshot_schoolId_term_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."LeagueSnapshot"
    ADD CONSTRAINT "LeagueSnapshot_schoolId_term_key" UNIQUE ("schoolId", term);


--
-- Name: LeagueWeekSnapshot LeagueWeekSnapshot_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."LeagueWeekSnapshot"
    ADD CONSTRAINT "LeagueWeekSnapshot_pkey" PRIMARY KEY (id);


--
-- Name: LearningEvent LearningEvent_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."LearningEvent"
    ADD CONSTRAINT "LearningEvent_pkey" PRIMARY KEY (id);


--
-- Name: LearningPathQueue LearningPathQueue_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."LearningPathQueue"
    ADD CONSTRAINT "LearningPathQueue_pkey" PRIMARY KEY (id);


--
-- Name: LearningPathQueue LearningPathQueue_studentId_lessonId_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."LearningPathQueue"
    ADD CONSTRAINT "LearningPathQueue_studentId_lessonId_key" UNIQUE ("studentId", "lessonId");


--
-- Name: LessonAudio LessonAudio_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."LessonAudio"
    ADD CONSTRAINT "LessonAudio_pkey" PRIMARY KEY (id);


--
-- Name: LessonHelpFlag LessonHelpFlag_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."LessonHelpFlag"
    ADD CONSTRAINT "LessonHelpFlag_pkey" PRIMARY KEY (id);


--
-- Name: LessonPrerequisite LessonPrerequisite_lessonId_prerequisiteLessonId_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."LessonPrerequisite"
    ADD CONSTRAINT "LessonPrerequisite_lessonId_prerequisiteLessonId_key" UNIQUE ("lessonId", "prerequisiteLessonId");


--
-- Name: LessonPrerequisite LessonPrerequisite_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."LessonPrerequisite"
    ADD CONSTRAINT "LessonPrerequisite_pkey" PRIMARY KEY (id);


--
-- Name: LessonShare LessonShare_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."LessonShare"
    ADD CONSTRAINT "LessonShare_pkey" PRIMARY KEY (id);


--
-- Name: LessonVariant LessonVariant_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."LessonVariant"
    ADD CONSTRAINT "LessonVariant_pkey" PRIMARY KEY (id);


--
-- Name: LessonVersion LessonVersion_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."LessonVersion"
    ADD CONSTRAINT "LessonVersion_pkey" PRIMARY KEY (id);


--
-- Name: LessonVideo LessonVideo_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."LessonVideo"
    ADD CONSTRAINT "LessonVideo_pkey" PRIMARY KEY (id);


--
-- Name: Lesson Lesson_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Lesson"
    ADD CONSTRAINT "Lesson_pkey" PRIMARY KEY (id);


--
-- Name: LongitudinalSnapshot LongitudinalSnapshot_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."LongitudinalSnapshot"
    ADD CONSTRAINT "LongitudinalSnapshot_pkey" PRIMARY KEY (id);


--
-- Name: MasteryRecord MasteryRecord_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MasteryRecord"
    ADD CONSTRAINT "MasteryRecord_pkey" PRIMARY KEY (id);


--
-- Name: MasterySnapshot MasterySnapshot_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MasterySnapshot"
    ADD CONSTRAINT "MasterySnapshot_pkey" PRIMARY KEY (id);


--
-- Name: MeetingAttendee MeetingAttendee_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MeetingAttendee"
    ADD CONSTRAINT "MeetingAttendee_pkey" PRIMARY KEY (id);


--
-- Name: Meeting Meeting_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Meeting"
    ADD CONSTRAINT "Meeting_pkey" PRIMARY KEY (id);


--
-- Name: MessageReadReceipt MessageReadReceipt_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MessageReadReceipt"
    ADD CONSTRAINT "MessageReadReceipt_pkey" PRIMARY KEY (id);


--
-- Name: Message Message_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Message"
    ADD CONSTRAINT "Message_pkey" PRIMARY KEY (id);


--
-- Name: MetricEvent MetricEvent_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MetricEvent"
    ADD CONSTRAINT "MetricEvent_pkey" PRIMARY KEY (id);


--
-- Name: MisconceptionCategory MisconceptionCategory_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MisconceptionCategory"
    ADD CONSTRAINT "MisconceptionCategory_pkey" PRIMARY KEY (id);


--
-- Name: MisconceptionTag MisconceptionTag_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MisconceptionTag"
    ADD CONSTRAINT "MisconceptionTag_pkey" PRIMARY KEY (id);


--
-- Name: MoeDirectiveApplication MoeDirectiveApplication_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MoeDirectiveApplication"
    ADD CONSTRAINT "MoeDirectiveApplication_pkey" PRIMARY KEY (id);


--
-- Name: MoePolicyDirective MoePolicyDirective_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MoePolicyDirective"
    ADD CONSTRAINT "MoePolicyDirective_pkey" PRIMARY KEY (id);


--
-- Name: MoeSubmission MoeSubmission_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MoeSubmission"
    ADD CONSTRAINT "MoeSubmission_pkey" PRIMARY KEY (id);


--
-- Name: NotificationInboxItem NotificationInboxItem_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."NotificationInboxItem"
    ADD CONSTRAINT "NotificationInboxItem_pkey" PRIMARY KEY (id);


--
-- Name: NotificationLog NotificationLog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."NotificationLog"
    ADD CONSTRAINT "NotificationLog_pkey" PRIMARY KEY (id);


--
-- Name: OfflinePack OfflinePack_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."OfflinePack"
    ADD CONSTRAINT "OfflinePack_pkey" PRIMARY KEY (id);


--
-- Name: OperatorIncidentNote OperatorIncidentNote_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."OperatorIncidentNote"
    ADD CONSTRAINT "OperatorIncidentNote_pkey" PRIMARY KEY (id);


--
-- Name: OptimizationChangeRequest OptimizationChangeRequest_idempotencyKey_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."OptimizationChangeRequest"
    ADD CONSTRAINT "OptimizationChangeRequest_idempotencyKey_key" UNIQUE ("idempotencyKey");


--
-- Name: OptimizationChangeRequest OptimizationChangeRequest_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."OptimizationChangeRequest"
    ADD CONSTRAINT "OptimizationChangeRequest_pkey" PRIMARY KEY (id);


--
-- Name: PartnerContact PartnerContact_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PartnerContact"
    ADD CONSTRAINT "PartnerContact_pkey" PRIMARY KEY (id);


--
-- Name: PartnerProgram PartnerProgram_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PartnerProgram"
    ADD CONSTRAINT "PartnerProgram_pkey" PRIMARY KEY (id);


--
-- Name: Partner Partner_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Partner"
    ADD CONSTRAINT "Partner_pkey" PRIMARY KEY (id);


--
-- Name: PasswordResetToken PasswordResetToken_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PasswordResetToken"
    ADD CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY (id);


--
-- Name: PilotChecklistItem PilotChecklistItem_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PilotChecklistItem"
    ADD CONSTRAINT "PilotChecklistItem_pkey" PRIMARY KEY (id);


--
-- Name: PilotChecklistStatus PilotChecklistStatus_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PilotChecklistStatus"
    ADD CONSTRAINT "PilotChecklistStatus_pkey" PRIMARY KEY (id);


--
-- Name: PipelineLock PipelineLock_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PipelineLock"
    ADD CONSTRAINT "PipelineLock_pkey" PRIMARY KEY (id);


--
-- Name: PlacementTest PlacementTest_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PlacementTest"
    ADD CONSTRAINT "PlacementTest_pkey" PRIMARY KEY (id);


--
-- Name: PlatformTransferToken PlatformTransferToken_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PlatformTransferToken"
    ADD CONSTRAINT "PlatformTransferToken_pkey" PRIMARY KEY (id);


--
-- Name: PortfolioCredential PortfolioCredential_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PortfolioCredential"
    ADD CONSTRAINT "PortfolioCredential_pkey" PRIMARY KEY (id);


--
-- Name: PortfolioCredential PortfolioCredential_verifyToken_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PortfolioCredential"
    ADD CONSTRAINT "PortfolioCredential_verifyToken_key" UNIQUE ("verifyToken");


--
-- Name: PortfolioItem PortfolioItem_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PortfolioItem"
    ADD CONSTRAINT "PortfolioItem_pkey" PRIMARY KEY (id);


--
-- Name: PortfolioShare PortfolioShare_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PortfolioShare"
    ADD CONSTRAINT "PortfolioShare_pkey" PRIMARY KEY (id);


--
-- Name: PortfolioShare PortfolioShare_shareCode_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PortfolioShare"
    ADD CONSTRAINT "PortfolioShare_shareCode_key" UNIQUE ("shareCode");


--
-- Name: PostChangeEvaluationPlan PostChangeEvaluationPlan_changeRequestId_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PostChangeEvaluationPlan"
    ADD CONSTRAINT "PostChangeEvaluationPlan_changeRequestId_key" UNIQUE ("changeRequestId");


--
-- Name: PostChangeEvaluationPlan PostChangeEvaluationPlan_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PostChangeEvaluationPlan"
    ADD CONSTRAINT "PostChangeEvaluationPlan_pkey" PRIMARY KEY (id);


--
-- Name: PracticeItem PracticeItem_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PracticeItem"
    ADD CONSTRAINT "PracticeItem_pkey" PRIMARY KEY (id);


--
-- Name: PushSubscription PushSubscription_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PushSubscription"
    ADD CONSTRAINT "PushSubscription_pkey" PRIMARY KEY (id);


--
-- Name: QuestionTag QuestionTag_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."QuestionTag"
    ADD CONSTRAINT "QuestionTag_pkey" PRIMARY KEY (id);


--
-- Name: RagChunk RagChunk_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RagChunk"
    ADD CONSTRAINT "RagChunk_pkey" PRIMARY KEY (id);


--
-- Name: ReportCard ReportCard_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ReportCard"
    ADD CONSTRAINT "ReportCard_pkey" PRIMARY KEY (id);


--
-- Name: ReportDraft ReportDraft_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ReportDraft"
    ADD CONSTRAINT "ReportDraft_pkey" PRIMARY KEY (id);


--
-- Name: ReviewSchedule ReviewSchedule_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ReviewSchedule"
    ADD CONSTRAINT "ReviewSchedule_pkey" PRIMARY KEY (id);


--
-- Name: SMSDeliveryLog SMSDeliveryLog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SMSDeliveryLog"
    ADD CONSTRAINT "SMSDeliveryLog_pkey" PRIMARY KEY (id);


--
-- Name: ScheduledWork ScheduledWork_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ScheduledWork"
    ADD CONSTRAINT "ScheduledWork_pkey" PRIMARY KEY (id);


--
-- Name: SchoolEvent SchoolEvent_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SchoolEvent"
    ADD CONSTRAINT "SchoolEvent_pkey" PRIMARY KEY (id);


--
-- Name: SchoolOnboarding SchoolOnboarding_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SchoolOnboarding"
    ADD CONSTRAINT "SchoolOnboarding_pkey" PRIMARY KEY (id);


--
-- Name: SchoolStorageQuota SchoolStorageQuota_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SchoolStorageQuota"
    ADD CONSTRAINT "SchoolStorageQuota_pkey" PRIMARY KEY (id);


--
-- Name: SchoolStorageQuota SchoolStorageQuota_schoolId_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SchoolStorageQuota"
    ADD CONSTRAINT "SchoolStorageQuota_schoolId_key" UNIQUE ("schoolId");


--
-- Name: School School_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."School"
    ADD CONSTRAINT "School_pkey" PRIMARY KEY (id);


--
-- Name: Session Session_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Session"
    ADD CONSTRAINT "Session_pkey" PRIMARY KEY (id);


--
-- Name: Skill Skill_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Skill"
    ADD CONSTRAINT "Skill_pkey" PRIMARY KEY (id);


--
-- Name: SloEvent SloEvent_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SloEvent"
    ADD CONSTRAINT "SloEvent_pkey" PRIMARY KEY (id);


--
-- Name: SmsResponse SmsResponse_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SmsResponse"
    ADD CONSTRAINT "SmsResponse_pkey" PRIMARY KEY (id);


--
-- Name: SmsSession SmsSession_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SmsSession"
    ADD CONSTRAINT "SmsSession_pkey" PRIMARY KEY (id);


--
-- Name: StagedRolloutPlan StagedRolloutPlan_changeRequestId_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."StagedRolloutPlan"
    ADD CONSTRAINT "StagedRolloutPlan_changeRequestId_key" UNIQUE ("changeRequestId");


--
-- Name: StagedRolloutPlan StagedRolloutPlan_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."StagedRolloutPlan"
    ADD CONSTRAINT "StagedRolloutPlan_pkey" PRIMARY KEY (id);


--
-- Name: Standard Standard_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Standard"
    ADD CONSTRAINT "Standard_pkey" PRIMARY KEY (id);


--
-- Name: StrandCatalog StrandCatalog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."StrandCatalog"
    ADD CONSTRAINT "StrandCatalog_pkey" PRIMARY KEY (id);


--
-- Name: StuckEvent StuckEvent_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."StuckEvent"
    ADD CONSTRAINT "StuckEvent_pkey" PRIMARY KEY (id);


--
-- Name: StudentAdaptiveAttempt StudentAdaptiveAttempt_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."StudentAdaptiveAttempt"
    ADD CONSTRAINT "StudentAdaptiveAttempt_pkey" PRIMARY KEY (id);


--
-- Name: StudentBadgeAward StudentBadgeAward_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."StudentBadgeAward"
    ADD CONSTRAINT "StudentBadgeAward_pkey" PRIMARY KEY (id);


--
-- Name: StudentGuardian StudentGuardian_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."StudentGuardian"
    ADD CONSTRAINT "StudentGuardian_pkey" PRIMARY KEY (id);


--
-- Name: StudentImportBatch StudentImportBatch_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."StudentImportBatch"
    ADD CONSTRAINT "StudentImportBatch_pkey" PRIMARY KEY (id);


--
-- Name: StudentMasteryProfile StudentMasteryProfile_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."StudentMasteryProfile"
    ADD CONSTRAINT "StudentMasteryProfile_pkey" PRIMARY KEY (id);


--
-- Name: StudentPerformanceEvent StudentPerformanceEvent_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."StudentPerformanceEvent"
    ADD CONSTRAINT "StudentPerformanceEvent_pkey" PRIMARY KEY (id);


--
-- Name: StudentProgress StudentProgress_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."StudentProgress"
    ADD CONSTRAINT "StudentProgress_pkey" PRIMARY KEY (id);


--
-- Name: StudentSession StudentSession_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."StudentSession"
    ADD CONSTRAINT "StudentSession_pkey" PRIMARY KEY (id);


--
-- Name: StudentStreak StudentStreak_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."StudentStreak"
    ADD CONSTRAINT "StudentStreak_pkey" PRIMARY KEY (id);


--
-- Name: Student Student_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Student"
    ADD CONSTRAINT "Student_pkey" PRIMARY KEY (id);


--
-- Name: Submission Submission_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Submission"
    ADD CONSTRAINT "Submission_pkey" PRIMARY KEY (id);


--
-- Name: SystemEvent SystemEvent_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SystemEvent"
    ADD CONSTRAINT "SystemEvent_pkey" PRIMARY KEY (id);


--
-- Name: TeacherAction TeacherAction_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TeacherAction"
    ADD CONSTRAINT "TeacherAction_pkey" PRIMARY KEY (id);


--
-- Name: TeacherAlertPreference TeacherAlertPreference_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TeacherAlertPreference"
    ADD CONSTRAINT "TeacherAlertPreference_pkey" PRIMARY KEY (id);


--
-- Name: TeacherAlertPreference TeacherAlertPreference_teacherId_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TeacherAlertPreference"
    ADD CONSTRAINT "TeacherAlertPreference_teacherId_key" UNIQUE ("teacherId");


--
-- Name: TeacherAlert TeacherAlert_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TeacherAlert"
    ADD CONSTRAINT "TeacherAlert_pkey" PRIMARY KEY (id);


--
-- Name: TeacherAssignment TeacherAssignment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TeacherAssignment"
    ADD CONSTRAINT "TeacherAssignment_pkey" PRIMARY KEY (id);


--
-- Name: TeacherLessonAssignment TeacherLessonAssignment_contentId_classId_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TeacherLessonAssignment"
    ADD CONSTRAINT "TeacherLessonAssignment_contentId_classId_key" UNIQUE ("contentId", "classId");


--
-- Name: TeacherLessonAssignment TeacherLessonAssignment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TeacherLessonAssignment"
    ADD CONSTRAINT "TeacherLessonAssignment_pkey" PRIMARY KEY (id);


--
-- Name: TeacherMorningBrief TeacherMorningBrief_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TeacherMorningBrief"
    ADD CONSTRAINT "TeacherMorningBrief_pkey" PRIMARY KEY (id);


--
-- Name: TeacherProfile TeacherProfile_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TeacherProfile"
    ADD CONSTRAINT "TeacherProfile_pkey" PRIMARY KEY (id);


--
-- Name: TeacherSentiment TeacherSentiment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TeacherSentiment"
    ADD CONSTRAINT "TeacherSentiment_pkey" PRIMARY KEY (id);


--
-- Name: TeachingLedger TeachingLedger_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TeachingLedger"
    ADD CONSTRAINT "TeachingLedger_pkey" PRIMARY KEY (id);


--
-- Name: TeachingSession TeachingSession_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TeachingSession"
    ADD CONSTRAINT "TeachingSession_pkey" PRIMARY KEY (id);


--
-- Name: TeachingTurn TeachingTurn_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TeachingTurn"
    ADD CONSTRAINT "TeachingTurn_pkey" PRIMARY KEY (id);


--
-- Name: Term Term_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Term"
    ADD CONSTRAINT "Term_pkey" PRIMARY KEY (id);


--
-- Name: TextbookGenerationJob TextbookGenerationJob_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TextbookGenerationJob"
    ADD CONSTRAINT "TextbookGenerationJob_pkey" PRIMARY KEY (id);


--
-- Name: TimetableAssignment TimetableAssignment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TimetableAssignment"
    ADD CONSTRAINT "TimetableAssignment_pkey" PRIMARY KEY (id);


--
-- Name: TimetableAssignment TimetableAssignment_timetableId_assignedDate_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TimetableAssignment"
    ADD CONSTRAINT "TimetableAssignment_timetableId_assignedDate_key" UNIQUE ("timetableId", "assignedDate");


--
-- Name: Timetable Timetable_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Timetable"
    ADD CONSTRAINT "Timetable_pkey" PRIMARY KEY (id);


--
-- Name: TrainingModule TrainingModule_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TrainingModule"
    ADD CONSTRAINT "TrainingModule_pkey" PRIMARY KEY (id);


--
-- Name: TrainingProgress TrainingProgress_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TrainingProgress"
    ADD CONSTRAINT "TrainingProgress_pkey" PRIMARY KEY (id);


--
-- Name: Transcript Transcript_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Transcript"
    ADD CONSTRAINT "Transcript_pkey" PRIMARY KEY (id);


--
-- Name: TrendSnapshot TrendSnapshot_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TrendSnapshot"
    ADD CONSTRAINT "TrendSnapshot_pkey" PRIMARY KEY (id);


--
-- Name: TutorConversation TutorConversation_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TutorConversation"
    ADD CONSTRAINT "TutorConversation_pkey" PRIMARY KEY (id);


--
-- Name: Unit Unit_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Unit"
    ADD CONSTRAINT "Unit_pkey" PRIMARY KEY (id);


--
-- Name: User User_loginId_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_loginId_key" UNIQUE ("loginId");


--
-- Name: User User_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_pkey" PRIMARY KEY (id);


--
-- Name: VideoWatchEvent VideoWatchEvent_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."VideoWatchEvent"
    ADD CONSTRAINT "VideoWatchEvent_pkey" PRIMARY KEY (id);


--
-- Name: VideoWatchEvent VideoWatchEvent_videoId_studentId_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."VideoWatchEvent"
    ADD CONSTRAINT "VideoWatchEvent_videoId_studentId_key" UNIQUE ("videoId", "studentId");


--
-- Name: VirtualLab VirtualLab_labId_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."VirtualLab"
    ADD CONSTRAINT "VirtualLab_labId_key" UNIQUE ("labId");


--
-- Name: VirtualLab VirtualLab_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."VirtualLab"
    ADD CONSTRAINT "VirtualLab_pkey" PRIMARY KEY (id);


--
-- Name: WaecPracticeItem WaecPracticeItem_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."WaecPracticeItem"
    ADD CONSTRAINT "WaecPracticeItem_pkey" PRIMARY KEY (id);


--
-- Name: WeeklyLeaderboard WeeklyLeaderboard_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."WeeklyLeaderboard"
    ADD CONSTRAINT "WeeklyLeaderboard_pkey" PRIMARY KEY (id);


--
-- Name: WorkflowCheckpoint WorkflowCheckpoint_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."WorkflowCheckpoint"
    ADD CONSTRAINT "WorkflowCheckpoint_pkey" PRIMARY KEY (id);


--
-- Name: WorkflowRun WorkflowRun_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."WorkflowRun"
    ADD CONSTRAINT "WorkflowRun_pkey" PRIMARY KEY (id);


--
-- Name: WorkflowStep WorkflowStep_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."WorkflowStep"
    ADD CONSTRAINT "WorkflowStep_pkey" PRIMARY KEY (id);


--
-- Name: _SkillToStandard _SkillToStandard_AB_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."_SkillToStandard"
    ADD CONSTRAINT "_SkillToStandard_AB_pkey" PRIMARY KEY ("A", "B");


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: AIInteraction_clientEventId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AIInteraction_clientEventId_idx" ON public."AIInteraction" USING btree ("clientEventId");


--
-- Name: AIInteraction_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AIInteraction_createdAt_idx" ON public."AIInteraction" USING btree ("createdAt");


--
-- Name: AIInteraction_dedupeKey_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AIInteraction_dedupeKey_idx" ON public."AIInteraction" USING btree ("dedupeKey");


--
-- Name: AIInteraction_feature_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AIInteraction_feature_createdAt_idx" ON public."AIInteraction" USING btree (feature, "createdAt");


--
-- Name: AIInteraction_schoolId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AIInteraction_schoolId_createdAt_idx" ON public."AIInteraction" USING btree ("schoolId", "createdAt");


--
-- Name: AIInteraction_sourceEventId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AIInteraction_sourceEventId_idx" ON public."AIInteraction" USING btree ("sourceEventId");


--
-- Name: AIInteraction_subject_strandKey_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AIInteraction_subject_strandKey_createdAt_idx" ON public."AIInteraction" USING btree (subject, "strandKey", "createdAt");


--
-- Name: AIInteraction_userId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AIInteraction_userId_createdAt_idx" ON public."AIInteraction" USING btree ("userId", "createdAt");


--
-- Name: AILiteracyExercise_lessonId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AILiteracyExercise_lessonId_idx" ON public."AILiteracyExercise" USING btree ("lessonId");


--
-- Name: AILiteracyExercise_promptId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "AILiteracyExercise_promptId_key" ON public."AILiteracyExercise" USING btree ("promptId");


--
-- Name: AcademicEnrollment_schoolId_academicYearId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AcademicEnrollment_schoolId_academicYearId_status_idx" ON public."AcademicEnrollment" USING btree ("schoolId", "academicYearId", status);


--
-- Name: AcademicEnrollment_studentId_academicYearId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AcademicEnrollment_studentId_academicYearId_idx" ON public."AcademicEnrollment" USING btree ("studentId", "academicYearId");


--
-- Name: AcademicEnrollment_studentId_schoolId_academicYearId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "AcademicEnrollment_studentId_schoolId_academicYearId_key" ON public."AcademicEnrollment" USING btree ("studentId", "schoolId", "academicYearId");


--
-- Name: AcademicYear_schoolId_isActive_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AcademicYear_schoolId_isActive_idx" ON public."AcademicYear" USING btree ("schoolId", "isActive");


--
-- Name: AcademicYear_schoolId_startDate_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AcademicYear_schoolId_startDate_idx" ON public."AcademicYear" USING btree ("schoolId", "startDate");


--
-- Name: AcademicYear_schoolId_yearLabel_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "AcademicYear_schoolId_yearLabel_key" ON public."AcademicYear" USING btree ("schoolId", "yearLabel");


--
-- Name: Account_provider_providerAccountId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON public."Account" USING btree (provider, "providerAccountId");


--
-- Name: ActionExecution_actionType_status_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ActionExecution_actionType_status_createdAt_idx" ON public."ActionExecution" USING btree ("actionType", status, "createdAt");


--
-- Name: ActionExecution_approvalRequestId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ActionExecution_approvalRequestId_idx" ON public."ActionExecution" USING btree ("approvalRequestId");


--
-- Name: ActionExecution_idempotencyKey_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "ActionExecution_idempotencyKey_key" ON public."ActionExecution" USING btree ("idempotencyKey");


--
-- Name: ActionExecution_schoolId_status_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ActionExecution_schoolId_status_createdAt_idx" ON public."ActionExecution" USING btree ("schoolId", status, "createdAt");


--
-- Name: ActionExecution_workflowRunId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ActionExecution_workflowRunId_createdAt_idx" ON public."ActionExecution" USING btree ("workflowRunId", "createdAt");


--
-- Name: AdaptiveMasteryRecord_studentId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AdaptiveMasteryRecord_studentId_idx" ON public."AdaptiveMasteryRecord" USING btree ("studentId");


--
-- Name: AgentControl_agentName_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "AgentControl_agentName_key" ON public."AgentControl" USING btree ("agentName");


--
-- Name: AgentCostAccounting_agentName_date_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "AgentCostAccounting_agentName_date_key" ON public."AgentCostAccounting" USING btree ("agentName", date);


--
-- Name: AgentDecision_agentRunId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AgentDecision_agentRunId_createdAt_idx" ON public."AgentDecision" USING btree ("agentRunId", "createdAt");


--
-- Name: AgentDecision_idempotencyKey_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "AgentDecision_idempotencyKey_key" ON public."AgentDecision" USING btree ("idempotencyKey");


--
-- Name: AgentDecision_status_riskLevel_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AgentDecision_status_riskLevel_createdAt_idx" ON public."AgentDecision" USING btree (status, "riskLevel", "createdAt");


--
-- Name: AgentDecision_workflowRunId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AgentDecision_workflowRunId_createdAt_idx" ON public."AgentDecision" USING btree ("workflowRunId", "createdAt");


--
-- Name: AgentGoal_initiatedBy_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AgentGoal_initiatedBy_idx" ON public."AgentGoal" USING btree ("initiatedBy");


--
-- Name: AgentGoal_status_updatedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AgentGoal_status_updatedAt_idx" ON public."AgentGoal" USING btree (status, "updatedAt");


--
-- Name: AgentInvocation_agentName_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AgentInvocation_agentName_createdAt_idx" ON public."AgentInvocation" USING btree ("agentName", "createdAt");


--
-- Name: AgentInvocation_goalId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AgentInvocation_goalId_idx" ON public."AgentInvocation" USING btree ("goalId");


--
-- Name: AgentInvocation_userId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AgentInvocation_userId_createdAt_idx" ON public."AgentInvocation" USING btree ("userId", "createdAt");


--
-- Name: AgentMetric_agentId_timestamp_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AgentMetric_agentId_timestamp_idx" ON public."AgentMetric" USING btree ("agentId", "timestamp");


--
-- Name: AgentRun_agentId_status_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AgentRun_agentId_status_createdAt_idx" ON public."AgentRun" USING btree ("agentId", status, "createdAt");


--
-- Name: AgentRun_idempotencyKey_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "AgentRun_idempotencyKey_key" ON public."AgentRun" USING btree ("idempotencyKey");


--
-- Name: AgentRun_schoolId_status_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AgentRun_schoolId_status_createdAt_idx" ON public."AgentRun" USING btree ("schoolId", status, "createdAt");


--
-- Name: AgentRun_workflowRunId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AgentRun_workflowRunId_createdAt_idx" ON public."AgentRun" USING btree ("workflowRunId", "createdAt");


--
-- Name: AgentTask_agentId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AgentTask_agentId_status_idx" ON public."AgentTask" USING btree ("agentId", status);


--
-- Name: AgentTask_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AgentTask_createdAt_idx" ON public."AgentTask" USING btree ("createdAt");


--
-- Name: AiInteractionLog_feature_timestamp_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AiInteractionLog_feature_timestamp_idx" ON public."AiInteractionLog" USING btree (feature, "timestamp");


--
-- Name: AiInteractionLog_schoolId_timestamp_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AiInteractionLog_schoolId_timestamp_idx" ON public."AiInteractionLog" USING btree ("schoolId", "timestamp");


--
-- Name: AiInteractionLog_subject_strandKey_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AiInteractionLog_subject_strandKey_idx" ON public."AiInteractionLog" USING btree (subject, "strandKey");


--
-- Name: AiInteractionLog_timestamp_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AiInteractionLog_timestamp_idx" ON public."AiInteractionLog" USING btree ("timestamp");


--
-- Name: AiInteractionLog_userId_timestamp_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AiInteractionLog_userId_timestamp_idx" ON public."AiInteractionLog" USING btree ("userId", "timestamp");


--
-- Name: Announcement_schoolId_audience_publishedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Announcement_schoolId_audience_publishedAt_idx" ON public."Announcement" USING btree ("schoolId", audience, "publishedAt");


--
-- Name: Announcement_schoolId_publishedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Announcement_schoolId_publishedAt_idx" ON public."Announcement" USING btree ("schoolId", "publishedAt");


--
-- Name: ApprovalRequest_approverRole_status_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ApprovalRequest_approverRole_status_createdAt_idx" ON public."ApprovalRequest" USING btree ("approverRole", status, "createdAt");


--
-- Name: ApprovalRequest_idempotencyKey_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "ApprovalRequest_idempotencyKey_key" ON public."ApprovalRequest" USING btree ("idempotencyKey");


--
-- Name: ApprovalRequest_schoolId_status_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ApprovalRequest_schoolId_status_createdAt_idx" ON public."ApprovalRequest" USING btree ("schoolId", status, "createdAt");


--
-- Name: ApprovalRequest_traceId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ApprovalRequest_traceId_createdAt_idx" ON public."ApprovalRequest" USING btree ("traceId", "createdAt");


--
-- Name: ApprovalRequest_workflowRunId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ApprovalRequest_workflowRunId_createdAt_idx" ON public."ApprovalRequest" USING btree ("workflowRunId", "createdAt");


--
-- Name: AssessmentAttemptDetail_attemptId_questionIdx_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AssessmentAttemptDetail_attemptId_questionIdx_idx" ON public."AssessmentAttemptDetail" USING btree ("attemptId", "questionIdx");


--
-- Name: AssessmentAttempt_assessmentId_attemptedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AssessmentAttempt_assessmentId_attemptedAt_idx" ON public."AssessmentAttempt" USING btree ("assessmentId", "attemptedAt");


--
-- Name: AssessmentAttempt_chainId_attemptedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AssessmentAttempt_chainId_attemptedAt_idx" ON public."AssessmentAttempt" USING btree ("chainId", "attemptedAt");


--
-- Name: AssessmentAttempt_schoolId_subject_attemptedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AssessmentAttempt_schoolId_subject_attemptedAt_idx" ON public."AssessmentAttempt" USING btree ("schoolId", subject, "attemptedAt");


--
-- Name: AssessmentAttempt_sourceEventId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AssessmentAttempt_sourceEventId_idx" ON public."AssessmentAttempt" USING btree ("sourceEventId");


--
-- Name: AssessmentAttempt_studentId_attemptedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AssessmentAttempt_studentId_attemptedAt_idx" ON public."AssessmentAttempt" USING btree ("studentId", "attemptedAt");


--
-- Name: AssignmentSubmission_aiGradedAt_teacherApproved_autoReleasedAt_; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AssignmentSubmission_aiGradedAt_teacherApproved_autoReleasedAt_" ON public."AssignmentSubmission" USING btree ("aiGradedAt", "teacherApproved", "autoReleasedAt");


--
-- Name: AssignmentSubmission_assignmentId_studentId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "AssignmentSubmission_assignmentId_studentId_key" ON public."AssignmentSubmission" USING btree ("assignmentId", "studentId");


--
-- Name: AssignmentSubmission_studentId_turnedInAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AssignmentSubmission_studentId_turnedInAt_idx" ON public."AssignmentSubmission" USING btree ("studentId", "turnedInAt");


--
-- Name: AssignmentSubmission_turnedInAt_assignmentId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AssignmentSubmission_turnedInAt_assignmentId_idx" ON public."AssignmentSubmission" USING btree ("turnedInAt", "assignmentId");


--
-- Name: AssignmentSuggestion_scheduledWorkId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AssignmentSuggestion_scheduledWorkId_idx" ON public."AssignmentSuggestion" USING btree ("scheduledWorkId");


--
-- Name: AssignmentSuggestion_schoolId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AssignmentSuggestion_schoolId_status_idx" ON public."AssignmentSuggestion" USING btree ("schoolId", status);


--
-- Name: AttendanceRecord_meetingId_studentId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "AttendanceRecord_meetingId_studentId_key" ON public."AttendanceRecord" USING btree ("meetingId", "studentId");


--
-- Name: Attendance_classId_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Attendance_classId_date_idx" ON public."Attendance" USING btree ("classId", date);


--
-- Name: Attendance_schoolId_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Attendance_schoolId_date_idx" ON public."Attendance" USING btree ("schoolId", date);


--
-- Name: Attendance_studentId_classId_date_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Attendance_studentId_classId_date_key" ON public."Attendance" USING btree ("studentId", "classId", date);


--
-- Name: Attendance_studentId_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Attendance_studentId_date_idx" ON public."Attendance" USING btree ("studentId", date);


--
-- Name: AuditLog_resourceType_resourceId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AuditLog_resourceType_resourceId_idx" ON public."AuditLog" USING btree ("resourceType", "resourceId");


--
-- Name: AuditLog_schoolId_action_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AuditLog_schoolId_action_createdAt_idx" ON public."AuditLog" USING btree ("schoolId", action, "createdAt");


--
-- Name: AuditLog_traceId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AuditLog_traceId_idx" ON public."AuditLog" USING btree ("traceId");


--
-- Name: AuditLog_userId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AuditLog_userId_createdAt_idx" ON public."AuditLog" USING btree ("userId", "createdAt");


--
-- Name: CanvaOAuthCredential_provider_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "CanvaOAuthCredential_provider_key" ON public."CanvaOAuthCredential" USING btree (provider);


--
-- Name: CanvaOAuthState_expiresAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CanvaOAuthState_expiresAt_idx" ON public."CanvaOAuthState" USING btree ("expiresAt");


--
-- Name: CanvaOAuthState_state_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "CanvaOAuthState_state_key" ON public."CanvaOAuthState" USING btree (state);


--
-- Name: CapstoneProject_studentId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CapstoneProject_studentId_status_idx" ON public."CapstoneProject" USING btree ("studentId", status);


--
-- Name: CapstoneProject_teacherId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CapstoneProject_teacherId_status_idx" ON public."CapstoneProject" USING btree ("teacherId", status);


--
-- Name: CertificateShare_certificateId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CertificateShare_certificateId_idx" ON public."CertificateShare" USING btree ("certificateId");


--
-- Name: CertificateShare_shareToken_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "CertificateShare_shareToken_key" ON public."CertificateShare" USING btree ("shareToken");


--
-- Name: CertificateShare_sharedById_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CertificateShare_sharedById_idx" ON public."CertificateShare" USING btree ("sharedById");


--
-- Name: Certificate_certificateCode_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Certificate_certificateCode_key" ON public."Certificate" USING btree ("certificateCode");


--
-- Name: Certificate_schoolId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Certificate_schoolId_status_idx" ON public."Certificate" USING btree ("schoolId", status);


--
-- Name: Certificate_studentId_awardedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Certificate_studentId_awardedAt_idx" ON public."Certificate" USING btree ("studentId", "awardedAt");


--
-- Name: Certificate_studentId_type_referenceId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Certificate_studentId_type_referenceId_key" ON public."Certificate" USING btree ("studentId", type, "referenceId");


--
-- Name: Certificate_type_referenceId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Certificate_type_referenceId_idx" ON public."Certificate" USING btree (type, "referenceId");


--
-- Name: ChangeRequestSignoff_changeRequestId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ChangeRequestSignoff_changeRequestId_createdAt_idx" ON public."ChangeRequestSignoff" USING btree ("changeRequestId", "createdAt");


--
-- Name: ChangeRequestSignoff_reviewerUserId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ChangeRequestSignoff_reviewerUserId_createdAt_idx" ON public."ChangeRequestSignoff" USING btree ("reviewerUserId", "createdAt");


--
-- Name: ChatMessage_studentId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ChatMessage_studentId_createdAt_idx" ON public."ChatMessage" USING btree ("studentId", "createdAt");


--
-- Name: CodeExercise_lessonId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CodeExercise_lessonId_idx" ON public."CodeExercise" USING btree ("lessonId");


--
-- Name: CodeExercise_promptId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "CodeExercise_promptId_key" ON public."CodeExercise" USING btree ("promptId");


--
-- Name: ConfusionSignal_schoolId_severity_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ConfusionSignal_schoolId_severity_idx" ON public."ConfusionSignal" USING btree ("schoolId", severity);


--
-- Name: ConfusionSignal_studentId_detectedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ConfusionSignal_studentId_detectedAt_idx" ON public."ConfusionSignal" USING btree ("studentId", "detectedAt");


--
-- Name: ConsentRecord_consentType_status_grantedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ConsentRecord_consentType_status_grantedAt_idx" ON public."ConsentRecord" USING btree ("consentType", status, "grantedAt");


--
-- Name: ConsentRecord_guardianId_consentType_grantedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ConsentRecord_guardianId_consentType_grantedAt_idx" ON public."ConsentRecord" USING btree ("guardianId", "consentType", "grantedAt");


--
-- Name: ConsentRecord_schoolId_consentType_grantedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ConsentRecord_schoolId_consentType_grantedAt_idx" ON public."ConsentRecord" USING btree ("schoolId", "consentType", "grantedAt");


--
-- Name: ConsentRecord_studentId_consentType_grantedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ConsentRecord_studentId_consentType_grantedAt_idx" ON public."ConsentRecord" USING btree ("studentId", "consentType", "grantedAt");


--
-- Name: ContentQaReview_submissionId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ContentQaReview_submissionId_idx" ON public."ContentQaReview" USING btree ("submissionId");


--
-- Name: ContentQaReview_submissionType_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ContentQaReview_submissionType_status_idx" ON public."ContentQaReview" USING btree ("submissionType", status);


--
-- Name: CurriculumContent_contentId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "CurriculumContent_contentId_key" ON public."CurriculumContent" USING btree ("contentId");


--
-- Name: CurriculumContent_contentType_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CurriculumContent_contentType_status_idx" ON public."CurriculumContent" USING btree ("contentType", status);


--
-- Name: CurriculumContent_editedById_editReviewStatus_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CurriculumContent_editedById_editReviewStatus_idx" ON public."CurriculumContent" USING btree ("editedById", "editReviewStatus");


--
-- Name: CurriculumContent_grade_subject_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CurriculumContent_grade_subject_idx" ON public."CurriculumContent" USING btree (grade, subject);


--
-- Name: CurriculumContent_hash_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "CurriculumContent_hash_key" ON public."CurriculumContent" USING btree (hash);


--
-- Name: CurriculumContent_imageCategory_imageGenerationStatus_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CurriculumContent_imageCategory_imageGenerationStatus_idx" ON public."CurriculumContent" USING btree ("imageCategory", "imageGenerationStatus");


--
-- Name: CurriculumContent_isHero_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CurriculumContent_isHero_idx" ON public."CurriculumContent" USING btree ("isHero") WHERE ("isHero" = true);


--
-- Name: CurriculumContent_schoolId_visibility_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CurriculumContent_schoolId_visibility_idx" ON public."CurriculumContent" USING btree ("schoolId", visibility);


--
-- Name: CurriculumContent_unitId_orderInUnit_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CurriculumContent_unitId_orderInUnit_idx" ON public."CurriculumContent" USING btree ("unitId", "orderInUnit");


--
-- Name: CurriculumContent_versionId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CurriculumContent_versionId_status_idx" ON public."CurriculumContent" USING btree ("versionId", status);


--
-- Name: CurriculumFeedback_action_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CurriculumFeedback_action_createdAt_idx" ON public."CurriculumFeedback" USING btree (action, "createdAt");


--
-- Name: CurriculumFeedback_curriculumId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CurriculumFeedback_curriculumId_idx" ON public."CurriculumFeedback" USING btree ("curriculumId");


--
-- Name: CurriculumFeedback_grade_subject_action_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CurriculumFeedback_grade_subject_action_idx" ON public."CurriculumFeedback" USING btree (grade, subject, action);


--
-- Name: CurriculumFlag_idempotencyKey_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "CurriculumFlag_idempotencyKey_key" ON public."CurriculumFlag" USING btree ("idempotencyKey");


--
-- Name: CurriculumFlag_lessonId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CurriculumFlag_lessonId_status_idx" ON public."CurriculumFlag" USING btree ("lessonId", status);


--
-- Name: CurriculumFlag_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CurriculumFlag_status_idx" ON public."CurriculumFlag" USING btree (status);


--
-- Name: CurriculumLessonPlan_curriculumContentId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "CurriculumLessonPlan_curriculumContentId_key" ON public."CurriculumLessonPlan" USING btree ("curriculumContentId");


--
-- Name: CurriculumLessonPlan_weekId_dayNumber_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CurriculumLessonPlan_weekId_dayNumber_idx" ON public."CurriculumLessonPlan" USING btree ("weekId", "dayNumber");


--
-- Name: CurriculumLessonPlan_weekId_dayNumber_orderIndex_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "CurriculumLessonPlan_weekId_dayNumber_orderIndex_key" ON public."CurriculumLessonPlan" USING btree ("weekId", "dayNumber", "orderIndex");


--
-- Name: CurriculumRegenerationCheckpoint_runId_gradeLevel_subject_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "CurriculumRegenerationCheckpoint_runId_gradeLevel_subject_key" ON public."CurriculumRegenerationCheckpoint" USING btree ("runId", "gradeLevel", subject);


--
-- Name: CurriculumRegenerationCheckpoint_status_updatedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CurriculumRegenerationCheckpoint_status_updatedAt_idx" ON public."CurriculumRegenerationCheckpoint" USING btree (status, "updatedAt");


--
-- Name: CurriculumRegenerationJob_curriculumContentId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CurriculumRegenerationJob_curriculumContentId_idx" ON public."CurriculumRegenerationJob" USING btree ("curriculumContentId");


--
-- Name: CurriculumRegenerationJob_gradeLevel_subject_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CurriculumRegenerationJob_gradeLevel_subject_status_idx" ON public."CurriculumRegenerationJob" USING btree ("gradeLevel", subject, status);


--
-- Name: CurriculumRegenerationJob_idempotencyKey_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "CurriculumRegenerationJob_idempotencyKey_key" ON public."CurriculumRegenerationJob" USING btree ("idempotencyKey");


--
-- Name: CurriculumRegenerationJob_runId_status_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CurriculumRegenerationJob_runId_status_createdAt_idx" ON public."CurriculumRegenerationJob" USING btree ("runId", status, "createdAt");


--
-- Name: CurriculumRegenerationRun_status_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CurriculumRegenerationRun_status_createdAt_idx" ON public."CurriculumRegenerationRun" USING btree (status, "createdAt");


--
-- Name: CurriculumRegenerationRun_targetStatus_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CurriculumRegenerationRun_targetStatus_status_idx" ON public."CurriculumRegenerationRun" USING btree ("targetStatus", status);


--
-- Name: CurriculumUnit_academicYearId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CurriculumUnit_academicYearId_idx" ON public."CurriculumUnit" USING btree ("academicYearId");


--
-- Name: CurriculumUnit_gradeLevel_subject_orderIndex_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CurriculumUnit_gradeLevel_subject_orderIndex_idx" ON public."CurriculumUnit" USING btree ("gradeLevel", subject, "orderIndex");


--
-- Name: CurriculumUnit_schoolId_grade_subject_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CurriculumUnit_schoolId_grade_subject_idx" ON public."CurriculumUnit" USING btree ("schoolId", grade, subject);


--
-- Name: CurriculumVersion_status_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CurriculumVersion_status_createdAt_idx" ON public."CurriculumVersion" USING btree (status, "createdAt");


--
-- Name: CurriculumVersion_versionName_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "CurriculumVersion_versionName_key" ON public."CurriculumVersion" USING btree ("versionName");


--
-- Name: CurriculumWeek_unitId_weekNumber_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "CurriculumWeek_unitId_weekNumber_key" ON public."CurriculumWeek" USING btree ("unitId", "weekNumber");


--
-- Name: CurriculumWeek_weekNumber_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CurriculumWeek_weekNumber_idx" ON public."CurriculumWeek" USING btree ("weekNumber");


--
-- Name: DataAccessLog_resourceType_action_accessedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "DataAccessLog_resourceType_action_accessedAt_idx" ON public."DataAccessLog" USING btree ("resourceType", action, "accessedAt");


--
-- Name: DataAccessLog_schoolId_accessedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "DataAccessLog_schoolId_accessedAt_idx" ON public."DataAccessLog" USING btree ("schoolId", "accessedAt");


--
-- Name: DataAccessLog_traceId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "DataAccessLog_traceId_idx" ON public."DataAccessLog" USING btree ("traceId");


--
-- Name: DataAccessLog_userId_accessedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "DataAccessLog_userId_accessedAt_idx" ON public."DataAccessLog" USING btree ("userId", "accessedAt");


--
-- Name: DataPolicyAcceptance_policyKey_policyVersion_acceptedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "DataPolicyAcceptance_policyKey_policyVersion_acceptedAt_idx" ON public."DataPolicyAcceptance" USING btree ("policyKey", "policyVersion", "acceptedAt");


--
-- Name: DataPolicyAcceptance_schoolId_acceptedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "DataPolicyAcceptance_schoolId_acceptedAt_idx" ON public."DataPolicyAcceptance" USING btree ("schoolId", "acceptedAt");


--
-- Name: DataPolicyAcceptance_userId_acceptedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "DataPolicyAcceptance_userId_acceptedAt_idx" ON public."DataPolicyAcceptance" USING btree ("userId", "acceptedAt");


--
-- Name: DerivedStudentProgress_schoolId_subject_derivedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "DerivedStudentProgress_schoolId_subject_derivedAt_idx" ON public."DerivedStudentProgress" USING btree ("schoolId", subject, "derivedAt");


--
-- Name: DerivedStudentProgress_sourceChainId_derivedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "DerivedStudentProgress_sourceChainId_derivedAt_idx" ON public."DerivedStudentProgress" USING btree ("sourceChainId", "derivedAt");


--
-- Name: DerivedStudentProgress_sourceSnapshotId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "DerivedStudentProgress_sourceSnapshotId_idx" ON public."DerivedStudentProgress" USING btree ("sourceSnapshotId");


--
-- Name: DerivedStudentProgress_studentId_derivedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "DerivedStudentProgress_studentId_derivedAt_idx" ON public."DerivedStudentProgress" USING btree ("studentId", "derivedAt");


--
-- Name: DerivedStudentProgress_studentId_subject_strandKey_derivedAt_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "DerivedStudentProgress_studentId_subject_strandKey_derivedAt_id" ON public."DerivedStudentProgress" USING btree ("studentId", subject, "strandKey", "derivedAt");


--
-- Name: DiscussionLastRead_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "DiscussionLastRead_userId_idx" ON public."DiscussionLastRead" USING btree ("userId");


--
-- Name: DiscussionLastRead_userId_threadId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "DiscussionLastRead_userId_threadId_key" ON public."DiscussionLastRead" USING btree ("userId", "threadId");


--
-- Name: DiscussionPost_threadId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "DiscussionPost_threadId_createdAt_idx" ON public."DiscussionPost" USING btree ("threadId", "createdAt");


--
-- Name: DiscussionPost_threadId_pending_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "DiscussionPost_threadId_pending_idx" ON public."DiscussionPost" USING btree ("threadId", pending);


--
-- Name: DiscussionThread_classId_contentId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "DiscussionThread_classId_contentId_idx" ON public."DiscussionThread" USING btree ("classId", "contentId");


--
-- Name: DiscussionThread_classId_pinned_updatedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "DiscussionThread_classId_pinned_updatedAt_idx" ON public."DiscussionThread" USING btree ("classId", pinned, "updatedAt");


--
-- Name: DiscussionThread_schoolId_classId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "DiscussionThread_schoolId_classId_idx" ON public."DiscussionThread" USING btree ("schoolId", "classId");


--
-- Name: DiscussionUpvote_postId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "DiscussionUpvote_postId_idx" ON public."DiscussionUpvote" USING btree ("postId");


--
-- Name: DiscussionUpvote_postId_userId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "DiscussionUpvote_postId_userId_key" ON public."DiscussionUpvote" USING btree ("postId", "userId");


--
-- Name: DistrictUpdateDraft_type_scope_scopeId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "DistrictUpdateDraft_type_scope_scopeId_createdAt_idx" ON public."DistrictUpdateDraft" USING btree (type, scope, "scopeId", "createdAt");


--
-- Name: District_isActive_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "District_isActive_idx" ON public."District" USING btree ("isActive");


--
-- Name: District_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "District_tenantId_idx" ON public."District" USING btree ("tenantId");


--
-- Name: Enrollment_classId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Enrollment_classId_idx" ON public."Enrollment" USING btree ("classId");


--
-- Name: Enrollment_studentId_classId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Enrollment_studentId_classId_key" ON public."Enrollment" USING btree ("studentId", "classId");


--
-- Name: EscalationQueue_status_priority_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "EscalationQueue_status_priority_createdAt_idx" ON public."EscalationQueue" USING btree (status, priority, "createdAt");


--
-- Name: EvalRun_passed_runAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "EvalRun_passed_runAt_idx" ON public."EvalRun" USING btree (passed, "runAt");


--
-- Name: EvalRun_runAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "EvalRun_runAt_idx" ON public."EvalRun" USING btree ("runAt");


--
-- Name: ExamAttempt_examId_studentId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ExamAttempt_examId_studentId_idx" ON public."ExamAttempt" USING btree ("examId", "studentId");


--
-- Name: ExamAttempt_examId_submittedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ExamAttempt_examId_submittedAt_idx" ON public."ExamAttempt" USING btree ("examId", "submittedAt");


--
-- Name: ExamAttempt_studentId_submittedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ExamAttempt_studentId_submittedAt_idx" ON public."ExamAttempt" USING btree ("studentId", "submittedAt");


--
-- Name: ExamCertification_certCode_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "ExamCertification_certCode_key" ON public."ExamCertification" USING btree ("certCode");


--
-- Name: ExamCertification_examId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ExamCertification_examId_idx" ON public."ExamCertification" USING btree ("examId");


--
-- Name: ExamCertification_studentId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ExamCertification_studentId_idx" ON public."ExamCertification" USING btree ("studentId");


--
-- Name: ExamQuestion_examId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ExamQuestion_examId_idx" ON public."ExamQuestion" USING btree ("examId");


--
-- Name: Exam_academicYearId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Exam_academicYearId_idx" ON public."Exam" USING btree ("academicYearId");


--
-- Name: Exam_classId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Exam_classId_idx" ON public."Exam" USING btree ("classId");


--
-- Name: Exam_schoolId_publishedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Exam_schoolId_publishedAt_idx" ON public."Exam" USING btree ("schoolId", "publishedAt");


--
-- Name: Exam_schoolId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Exam_schoolId_status_idx" ON public."Exam" USING btree ("schoolId", status);


--
-- Name: Exam_schoolId_subject_grade_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Exam_schoolId_subject_grade_idx" ON public."Exam" USING btree ("schoolId", subject, grade);


--
-- Name: ExecutionTrace_schoolId_status_startedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ExecutionTrace_schoolId_status_startedAt_idx" ON public."ExecutionTrace" USING btree ("schoolId", status, "startedAt");


--
-- Name: ExecutionTrace_spanType_status_startedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ExecutionTrace_spanType_status_startedAt_idx" ON public."ExecutionTrace" USING btree ("spanType", status, "startedAt");


--
-- Name: ExecutionTrace_traceId_startedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ExecutionTrace_traceId_startedAt_idx" ON public."ExecutionTrace" USING btree ("traceId", "startedAt");


--
-- Name: ExecutionTrace_workflowRunId_startedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ExecutionTrace_workflowRunId_startedAt_idx" ON public."ExecutionTrace" USING btree ("workflowRunId", "startedAt");


--
-- Name: ExportJobRequest_approvalStatus_requestedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ExportJobRequest_approvalStatus_requestedAt_idx" ON public."ExportJobRequest" USING btree ("approvalStatus", "requestedAt");


--
-- Name: ExportJobRequest_exportType_requestedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ExportJobRequest_exportType_requestedAt_idx" ON public."ExportJobRequest" USING btree ("exportType", "requestedAt");


--
-- Name: ExportJobRequest_requestedByUserId_requestedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ExportJobRequest_requestedByUserId_requestedAt_idx" ON public."ExportJobRequest" USING btree ("requestedByUserId", "requestedAt");


--
-- Name: ExportJobRequest_schoolId_scope_requestedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ExportJobRequest_schoolId_scope_requestedAt_idx" ON public."ExportJobRequest" USING btree ("schoolId", scope, "requestedAt");


--
-- Name: ExportJobRequest_status_requestedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ExportJobRequest_status_requestedAt_idx" ON public."ExportJobRequest" USING btree (status, "requestedAt");


--
-- Name: ExportRecord_exportType_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ExportRecord_exportType_createdAt_idx" ON public."ExportRecord" USING btree ("exportType", "createdAt");


--
-- Name: ExportRecord_scope_scopeId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ExportRecord_scope_scopeId_createdAt_idx" ON public."ExportRecord" USING btree (scope, "scopeId", "createdAt");


--
-- Name: ExportRecord_userId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ExportRecord_userId_createdAt_idx" ON public."ExportRecord" USING btree ("userId", "createdAt");


--
-- Name: GeneratedDocument_schoolId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "GeneratedDocument_schoolId_createdAt_idx" ON public."GeneratedDocument" USING btree ("schoolId", "createdAt");


--
-- Name: GeneratedDocument_schoolId_type_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "GeneratedDocument_schoolId_type_status_idx" ON public."GeneratedDocument" USING btree ("schoolId", type, status);


--
-- Name: GeneratedDocument_studentId_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "GeneratedDocument_studentId_type_idx" ON public."GeneratedDocument" USING btree ("studentId", type);


--
-- Name: GradePipelineJob_completedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "GradePipelineJob_completedAt_idx" ON public."GradePipelineJob" USING btree ("completedAt");


--
-- Name: GradePipelineJob_grade_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "GradePipelineJob_grade_key" ON public."GradePipelineJob" USING btree (grade);


--
-- Name: GradePipelineJob_status_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "GradePipelineJob_status_createdAt_idx" ON public."GradePipelineJob" USING btree (status, "createdAt");


--
-- Name: Grade_classId_studentId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Grade_classId_studentId_idx" ON public."Grade" USING btree ("classId", "studentId");


--
-- Name: GradedSubmission_clientSubmissionId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "GradedSubmission_clientSubmissionId_key" ON public."GradedSubmission" USING btree ("clientSubmissionId") WHERE ("clientSubmissionId" IS NOT NULL);


--
-- Name: GradedSubmission_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "GradedSubmission_status_idx" ON public."GradedSubmission" USING btree (status);


--
-- Name: GradedSubmission_studentId_lessonId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "GradedSubmission_studentId_lessonId_idx" ON public."GradedSubmission" USING btree ("studentId", "lessonId");


--
-- Name: GuardianConsent_schoolId_pilotOnly_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "GuardianConsent_schoolId_pilotOnly_createdAt_idx" ON public."GuardianConsent" USING btree ("schoolId", "pilotOnly", "createdAt");


--
-- Name: GuardianConsent_schoolId_studentId_guardianId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "GuardianConsent_schoolId_studentId_guardianId_key" ON public."GuardianConsent" USING btree ("schoolId", "studentId", "guardianId");


--
-- Name: GuardianConversation_expiresAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "GuardianConversation_expiresAt_idx" ON public."GuardianConversation" USING btree ("expiresAt");


--
-- Name: GuardianConversation_guardianPhone_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "GuardianConversation_guardianPhone_key" ON public."GuardianConversation" USING btree ("guardianPhone");


--
-- Name: GuardianMessage_guardianId_sentAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "GuardianMessage_guardianId_sentAt_idx" ON public."GuardianMessage" USING btree ("guardianId", "sentAt");


--
-- Name: GuardianMessage_schoolId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "GuardianMessage_schoolId_idx" ON public."GuardianMessage" USING btree ("schoolId");


--
-- Name: GuardianMessage_studentId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "GuardianMessage_studentId_idx" ON public."GuardianMessage" USING btree ("studentId");


--
-- Name: GuardianMessage_teacherId_sentAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "GuardianMessage_teacherId_sentAt_idx" ON public."GuardianMessage" USING btree ("teacherId", "sentAt");


--
-- Name: GuardianSmsCostAccounting_guardianPhone_date_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "GuardianSmsCostAccounting_guardianPhone_date_key" ON public."GuardianSmsCostAccounting" USING btree ("guardianPhone", date);


--
-- Name: HomeworkSubmission_clientSubmissionId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "HomeworkSubmission_clientSubmissionId_key" ON public."HomeworkSubmission" USING btree ("clientSubmissionId") WHERE ("clientSubmissionId" IS NOT NULL);


--
-- Name: HomeworkSubmission_homeworkId_studentId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "HomeworkSubmission_homeworkId_studentId_key" ON public."HomeworkSubmission" USING btree ("homeworkId", "studentId");


--
-- Name: HomeworkSubmission_studentId_submittedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "HomeworkSubmission_studentId_submittedAt_idx" ON public."HomeworkSubmission" USING btree ("studentId", "submittedAt");


--
-- Name: ImpactSnapshot_classId_period_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ImpactSnapshot_classId_period_idx" ON public."ImpactSnapshot" USING btree ("classId", period);


--
-- Name: ImpactSnapshot_generatedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ImpactSnapshot_generatedAt_idx" ON public."ImpactSnapshot" USING btree ("generatedAt");


--
-- Name: ImpactSnapshot_schoolId_period_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ImpactSnapshot_schoolId_period_idx" ON public."ImpactSnapshot" USING btree ("schoolId", period);


--
-- Name: ImpactSnapshot_tenantId_period_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ImpactSnapshot_tenantId_period_idx" ON public."ImpactSnapshot" USING btree ("tenantId", period);


--
-- Name: InterventionChain_schoolId_status_currentStage_openedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "InterventionChain_schoolId_status_currentStage_openedAt_idx" ON public."InterventionChain" USING btree ("schoolId", status, "currentStage", "openedAt");


--
-- Name: InterventionChain_sourceAssessmentAttemptId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "InterventionChain_sourceAssessmentAttemptId_idx" ON public."InterventionChain" USING btree ("sourceAssessmentAttemptId");


--
-- Name: InterventionChain_studentId_status_openedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "InterventionChain_studentId_status_openedAt_idx" ON public."InterventionChain" USING btree ("studentId", status, "openedAt");


--
-- Name: InterventionChain_teacherUserId_status_openedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "InterventionChain_teacherUserId_status_openedAt_idx" ON public."InterventionChain" USING btree ("teacherUserId", status, "openedAt");


--
-- Name: InterventionLog_districtId_generatedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "InterventionLog_districtId_generatedAt_idx" ON public."InterventionLog" USING btree ("districtId", "generatedAt");


--
-- Name: InterventionLog_schoolId_generatedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "InterventionLog_schoolId_generatedAt_idx" ON public."InterventionLog" USING btree ("schoolId", "generatedAt");


--
-- Name: InterventionLog_tenantId_generatedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "InterventionLog_tenantId_generatedAt_idx" ON public."InterventionLog" USING btree ("tenantId", "generatedAt");


--
-- Name: InterventionRecommendation_idempotencyKey_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "InterventionRecommendation_idempotencyKey_key" ON public."InterventionRecommendation" USING btree ("idempotencyKey") WHERE ("idempotencyKey" IS NOT NULL);


--
-- Name: InterventionRecommendation_schoolId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "InterventionRecommendation_schoolId_status_idx" ON public."InterventionRecommendation" USING btree ("schoolId", status);


--
-- Name: InterventionRecommendation_studentId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "InterventionRecommendation_studentId_createdAt_idx" ON public."InterventionRecommendation" USING btree ("studentId", "createdAt");


--
-- Name: Intervention_chainId_openedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Intervention_chainId_openedAt_idx" ON public."Intervention" USING btree ("chainId", "openedAt");


--
-- Name: Intervention_recommendationId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Intervention_recommendationId_idx" ON public."Intervention" USING btree ("recommendationId");


--
-- Name: Intervention_schoolId_status_openedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Intervention_schoolId_status_openedAt_idx" ON public."Intervention" USING btree ("schoolId", status, "openedAt");


--
-- Name: Intervention_sourceAttemptId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Intervention_sourceAttemptId_idx" ON public."Intervention" USING btree ("sourceAttemptId");


--
-- Name: Intervention_studentId_openedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Intervention_studentId_openedAt_idx" ON public."Intervention" USING btree ("studentId", "openedAt");


--
-- Name: Intervention_tenantId_openedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Intervention_tenantId_openedAt_idx" ON public."Intervention" USING btree ("tenantId", "openedAt");


--
-- Name: InviteToken_tokenHash_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "InviteToken_tokenHash_key" ON public."InviteToken" USING btree ("tokenHash");


--
-- Name: InviteToken_token_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "InviteToken_token_key" ON public."InviteToken" USING btree (token);


--
-- Name: LabSession_scheduledWorkId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LabSession_scheduledWorkId_idx" ON public."LabSession" USING btree ("scheduledWorkId");


--
-- Name: LabSession_schoolId_labId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LabSession_schoolId_labId_idx" ON public."LabSession" USING btree ("schoolId", "labId");


--
-- Name: LabSession_studentId_schoolId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LabSession_studentId_schoolId_idx" ON public."LabSession" USING btree ("studentId", "schoolId");


--
-- Name: LeagueSnapshot_term_nationalRank_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LeagueSnapshot_term_nationalRank_idx" ON public."LeagueSnapshot" USING btree (term, "nationalRank");


--
-- Name: LeagueWeekSnapshot_district_weekStart_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LeagueWeekSnapshot_district_weekStart_idx" ON public."LeagueWeekSnapshot" USING btree (district, "weekStart");


--
-- Name: LeagueWeekSnapshot_district_weekStart_schoolId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "LeagueWeekSnapshot_district_weekStart_schoolId_key" ON public."LeagueWeekSnapshot" USING btree (district, "weekStart", "schoolId");


--
-- Name: LeagueWeekSnapshot_schoolId_weekStart_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LeagueWeekSnapshot_schoolId_weekStart_idx" ON public."LeagueWeekSnapshot" USING btree ("schoolId", "weekStart");


--
-- Name: LearningEvent_clientEventId_eventType_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LearningEvent_clientEventId_eventType_idx" ON public."LearningEvent" USING btree ("clientEventId", "eventType");


--
-- Name: LearningEvent_contentId_occurredAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LearningEvent_contentId_occurredAt_idx" ON public."LearningEvent" USING btree ("contentId", "occurredAt");


--
-- Name: LearningEvent_correlationId_occurredAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LearningEvent_correlationId_occurredAt_idx" ON public."LearningEvent" USING btree ("correlationId", "occurredAt");


--
-- Name: LearningEvent_dedupeKey_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LearningEvent_dedupeKey_idx" ON public."LearningEvent" USING btree ("dedupeKey");


--
-- Name: LearningEvent_eventType_occurredAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LearningEvent_eventType_occurredAt_idx" ON public."LearningEvent" USING btree ("eventType", "occurredAt");


--
-- Name: LearningEvent_schoolId_occurredAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LearningEvent_schoolId_occurredAt_idx" ON public."LearningEvent" USING btree ("schoolId", "occurredAt");


--
-- Name: LearningEvent_studentId_occurredAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LearningEvent_studentId_occurredAt_idx" ON public."LearningEvent" USING btree ("studentId", "occurredAt");


--
-- Name: LearningEvent_userId_occurredAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LearningEvent_userId_occurredAt_idx" ON public."LearningEvent" USING btree ("userId", "occurredAt");


--
-- Name: LearningEvent_workflowRunId_occurredAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LearningEvent_workflowRunId_occurredAt_idx" ON public."LearningEvent" USING btree ("workflowRunId", "occurredAt");


--
-- Name: LearningEvent_workflowTraceId_occurredAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LearningEvent_workflowTraceId_occurredAt_idx" ON public."LearningEvent" USING btree ("workflowTraceId", "occurredAt");


--
-- Name: LearningPathQueue_studentId_resolvedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LearningPathQueue_studentId_resolvedAt_idx" ON public."LearningPathQueue" USING btree ("studentId", "resolvedAt");


--
-- Name: LessonAudio_lessonId_contentVersion_voice_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "LessonAudio_lessonId_contentVersion_voice_key" ON public."LessonAudio" USING btree ("lessonId", "contentVersion", voice);


--
-- Name: LessonAudio_lessonId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LessonAudio_lessonId_status_idx" ON public."LessonAudio" USING btree ("lessonId", status);


--
-- Name: LessonAudio_status_generatedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LessonAudio_status_generatedAt_idx" ON public."LessonAudio" USING btree (status, "generatedAt");


--
-- Name: LessonHelpFlag_studentId_contentId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LessonHelpFlag_studentId_contentId_idx" ON public."LessonHelpFlag" USING btree ("studentId", "contentId");


--
-- Name: LessonHelpFlag_studentId_contentId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "LessonHelpFlag_studentId_contentId_key" ON public."LessonHelpFlag" USING btree ("studentId", "contentId");


--
-- Name: LessonPrerequisite_lessonId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LessonPrerequisite_lessonId_idx" ON public."LessonPrerequisite" USING btree ("lessonId");


--
-- Name: LessonPrerequisite_prerequisiteLessonId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LessonPrerequisite_prerequisiteLessonId_idx" ON public."LessonPrerequisite" USING btree ("prerequisiteLessonId");


--
-- Name: LessonShare_lessonId_schoolId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "LessonShare_lessonId_schoolId_key" ON public."LessonShare" USING btree ("lessonId", "schoolId");


--
-- Name: LessonShare_schoolId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LessonShare_schoolId_idx" ON public."LessonShare" USING btree ("schoolId");


--
-- Name: LessonVariant_lessonId_variantType_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LessonVariant_lessonId_variantType_idx" ON public."LessonVariant" USING btree ("lessonId", "variantType");


--
-- Name: LessonVersion_lessonId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LessonVersion_lessonId_createdAt_idx" ON public."LessonVersion" USING btree ("lessonId", "createdAt");


--
-- Name: LessonVideo_lessonId_isActive_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LessonVideo_lessonId_isActive_idx" ON public."LessonVideo" USING btree ("lessonId", "isActive");


--
-- Name: LessonVideo_schoolId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LessonVideo_schoolId_status_idx" ON public."LessonVideo" USING btree ("schoolId", status);


--
-- Name: LessonVideo_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LessonVideo_status_idx" ON public."LessonVideo" USING btree (status);


--
-- Name: LessonVideo_uploadedBy_uploadedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LessonVideo_uploadedBy_uploadedAt_idx" ON public."LessonVideo" USING btree ("uploadedBy", "uploadedAt");


--
-- Name: LongitudinalSnapshot_classification_periodStart_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LongitudinalSnapshot_classification_periodStart_idx" ON public."LongitudinalSnapshot" USING btree (classification, "periodStart");


--
-- Name: LongitudinalSnapshot_schoolId_studentId_periodStart_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LongitudinalSnapshot_schoolId_studentId_periodStart_idx" ON public."LongitudinalSnapshot" USING btree ("schoolId", "studentId", "periodStart");


--
-- Name: LongitudinalSnapshot_subject_strandKey_periodStart_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LongitudinalSnapshot_subject_strandKey_periodStart_idx" ON public."LongitudinalSnapshot" USING btree (subject, "strandKey", "periodStart");


--
-- Name: LongitudinalSnapshot_tenantId_schoolId_periodStart_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LongitudinalSnapshot_tenantId_schoolId_periodStart_idx" ON public."LongitudinalSnapshot" USING btree ("tenantId", "schoolId", "periodStart");


--
-- Name: MasteryRecord_studentId_skillId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "MasteryRecord_studentId_skillId_key" ON public."MasteryRecord" USING btree ("studentId", "skillId");


--
-- Name: MasterySnapshot_previousSnapshotId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "MasterySnapshot_previousSnapshotId_idx" ON public."MasterySnapshot" USING btree ("previousSnapshotId");


--
-- Name: MasterySnapshot_schoolId_subject_capturedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "MasterySnapshot_schoolId_subject_capturedAt_idx" ON public."MasterySnapshot" USING btree ("schoolId", subject, "capturedAt");


--
-- Name: MasterySnapshot_sourceAttemptId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "MasterySnapshot_sourceAttemptId_idx" ON public."MasterySnapshot" USING btree ("sourceAttemptId");


--
-- Name: MasterySnapshot_sourceEventId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "MasterySnapshot_sourceEventId_idx" ON public."MasterySnapshot" USING btree ("sourceEventId");


--
-- Name: MasterySnapshot_sourceProfileId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "MasterySnapshot_sourceProfileId_idx" ON public."MasterySnapshot" USING btree ("sourceProfileId");


--
-- Name: MasterySnapshot_studentId_capturedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "MasterySnapshot_studentId_capturedAt_idx" ON public."MasterySnapshot" USING btree ("studentId", "capturedAt");


--
-- Name: MasterySnapshot_studentId_subject_strandKey_capturedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "MasterySnapshot_studentId_subject_strandKey_capturedAt_idx" ON public."MasterySnapshot" USING btree ("studentId", subject, "strandKey", "capturedAt");


--
-- Name: MeetingAttendee_meetingId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "MeetingAttendee_meetingId_idx" ON public."MeetingAttendee" USING btree ("meetingId");


--
-- Name: MeetingAttendee_meetingId_userId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "MeetingAttendee_meetingId_userId_key" ON public."MeetingAttendee" USING btree ("meetingId", "userId");


--
-- Name: Meeting_classId_startsAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Meeting_classId_startsAt_idx" ON public."Meeting" USING btree ("classId", "startsAt");


--
-- Name: Meeting_liveStatus_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Meeting_liveStatus_idx" ON public."Meeting" USING btree ("liveStatus");


--
-- Name: MessageReadReceipt_messageId_userId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "MessageReadReceipt_messageId_userId_key" ON public."MessageReadReceipt" USING btree ("messageId", "userId");


--
-- Name: Message_flagged_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Message_flagged_idx" ON public."Message" USING btree (flagged);


--
-- Name: Message_fromUserId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Message_fromUserId_createdAt_idx" ON public."Message" USING btree ("fromUserId", "createdAt");


--
-- Name: Message_threadKey_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Message_threadKey_createdAt_idx" ON public."Message" USING btree ("threadKey", "createdAt");


--
-- Name: Message_toUserId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Message_toUserId_createdAt_idx" ON public."Message" USING btree ("toUserId", "createdAt");


--
-- Name: MetricEvent_name_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "MetricEvent_name_createdAt_idx" ON public."MetricEvent" USING btree (name, "createdAt");


--
-- Name: MetricEvent_schoolId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "MetricEvent_schoolId_createdAt_idx" ON public."MetricEvent" USING btree ("schoolId", "createdAt");


--
-- Name: MetricEvent_scope_scopeId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "MetricEvent_scope_scopeId_createdAt_idx" ON public."MetricEvent" USING btree (scope, "scopeId", "createdAt");


--
-- Name: MetricEvent_severity_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "MetricEvent_severity_createdAt_idx" ON public."MetricEvent" USING btree (severity, "createdAt");


--
-- Name: MisconceptionCategory_createdByUserId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "MisconceptionCategory_createdByUserId_createdAt_idx" ON public."MisconceptionCategory" USING btree ("createdByUserId", "createdAt");


--
-- Name: MisconceptionCategory_schoolId_code_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "MisconceptionCategory_schoolId_code_key" ON public."MisconceptionCategory" USING btree ("schoolId", code);


--
-- Name: MisconceptionCategory_subject_strandKey_isActive_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "MisconceptionCategory_subject_strandKey_isActive_idx" ON public."MisconceptionCategory" USING btree (subject, "strandKey", "isActive");


--
-- Name: MisconceptionTag_assessmentAttemptId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "MisconceptionTag_assessmentAttemptId_createdAt_idx" ON public."MisconceptionTag" USING btree ("assessmentAttemptId", "createdAt");


--
-- Name: MisconceptionTag_categoryId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "MisconceptionTag_categoryId_createdAt_idx" ON public."MisconceptionTag" USING btree ("categoryId", "createdAt");


--
-- Name: MisconceptionTag_chainId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "MisconceptionTag_chainId_createdAt_idx" ON public."MisconceptionTag" USING btree ("chainId", "createdAt");


--
-- Name: MisconceptionTag_studentId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "MisconceptionTag_studentId_createdAt_idx" ON public."MisconceptionTag" USING btree ("studentId", "createdAt");


--
-- Name: MoeDirectiveApplication_directiveId_schoolId_classId_grade_subj; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "MoeDirectiveApplication_directiveId_schoolId_classId_grade_subj" ON public."MoeDirectiveApplication" USING btree ("directiveId", "schoolId", "classId", grade, subject);


--
-- Name: MoeDirectiveApplication_directiveId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "MoeDirectiveApplication_directiveId_status_idx" ON public."MoeDirectiveApplication" USING btree ("directiveId", status);


--
-- Name: MoeDirectiveApplication_grade_subject_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "MoeDirectiveApplication_grade_subject_status_idx" ON public."MoeDirectiveApplication" USING btree (grade, subject, status);


--
-- Name: MoeDirectiveApplication_schoolId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "MoeDirectiveApplication_schoolId_status_idx" ON public."MoeDirectiveApplication" USING btree ("schoolId", status);


--
-- Name: MoePolicyDirective_districtId_schoolId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "MoePolicyDirective_districtId_schoolId_idx" ON public."MoePolicyDirective" USING btree ("districtId", "schoolId");


--
-- Name: MoePolicyDirective_policyType_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "MoePolicyDirective_policyType_status_idx" ON public."MoePolicyDirective" USING btree ("policyType", status);


--
-- Name: MoePolicyDirective_status_targetScope_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "MoePolicyDirective_status_targetScope_createdAt_idx" ON public."MoePolicyDirective" USING btree (status, "targetScope", "createdAt");


--
-- Name: MoeSubmission_schoolId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "MoeSubmission_schoolId_idx" ON public."MoeSubmission" USING btree ("schoolId");


--
-- Name: MoeSubmission_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "MoeSubmission_status_idx" ON public."MoeSubmission" USING btree (status);


--
-- Name: MoeSubmission_submittedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "MoeSubmission_submittedAt_idx" ON public."MoeSubmission" USING btree ("submittedAt");


--
-- Name: NotificationInboxItem_userId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "NotificationInboxItem_userId_createdAt_idx" ON public."NotificationInboxItem" USING btree ("userId", "createdAt");


--
-- Name: NotificationInboxItem_userId_isRead_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "NotificationInboxItem_userId_isRead_idx" ON public."NotificationInboxItem" USING btree ("userId", "isRead");


--
-- Name: NotificationLog_status_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "NotificationLog_status_createdAt_idx" ON public."NotificationLog" USING btree (status, "createdAt");


--
-- Name: NotificationLog_userId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "NotificationLog_userId_createdAt_idx" ON public."NotificationLog" USING btree ("userId", "createdAt");


--
-- Name: OfflinePack_expiresAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "OfflinePack_expiresAt_idx" ON public."OfflinePack" USING btree ("expiresAt");


--
-- Name: OfflinePack_requestedById_weekStart_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "OfflinePack_requestedById_weekStart_idx" ON public."OfflinePack" USING btree ("requestedById", "weekStart");


--
-- Name: OfflinePack_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "OfflinePack_status_idx" ON public."OfflinePack" USING btree (status);


--
-- Name: OperatorIncidentNote_createdByUserId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "OperatorIncidentNote_createdByUserId_createdAt_idx" ON public."OperatorIncidentNote" USING btree ("createdByUserId", "createdAt");


--
-- Name: OperatorIncidentNote_status_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "OperatorIncidentNote_status_createdAt_idx" ON public."OperatorIncidentNote" USING btree (status, "createdAt");


--
-- Name: OperatorIncidentNote_workflowRunId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "OperatorIncidentNote_workflowRunId_createdAt_idx" ON public."OperatorIncidentNote" USING btree ("workflowRunId", "createdAt");


--
-- Name: OptimizationChangeRequest_correlationId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "OptimizationChangeRequest_correlationId_createdAt_idx" ON public."OptimizationChangeRequest" USING btree ("correlationId", "createdAt");


--
-- Name: OptimizationChangeRequest_proposalEventId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "OptimizationChangeRequest_proposalEventId_idx" ON public."OptimizationChangeRequest" USING btree ("proposalEventId");


--
-- Name: OptimizationChangeRequest_schoolId_status_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "OptimizationChangeRequest_schoolId_status_createdAt_idx" ON public."OptimizationChangeRequest" USING btree ("schoolId", status, "createdAt");


--
-- Name: OptimizationChangeRequest_status_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "OptimizationChangeRequest_status_createdAt_idx" ON public."OptimizationChangeRequest" USING btree (status, "createdAt");


--
-- Name: PasswordResetToken_tokenHash_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON public."PasswordResetToken" USING btree ("tokenHash");


--
-- Name: PasswordResetToken_token_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "PasswordResetToken_token_key" ON public."PasswordResetToken" USING btree (token);


--
-- Name: PilotChecklistItem_active_sortOrder_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PilotChecklistItem_active_sortOrder_idx" ON public."PilotChecklistItem" USING btree (active, "sortOrder");


--
-- Name: PilotChecklistStatus_schoolId_completedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PilotChecklistStatus_schoolId_completedAt_idx" ON public."PilotChecklistStatus" USING btree ("schoolId", "completedAt");


--
-- Name: PilotChecklistStatus_schoolId_itemId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "PilotChecklistStatus_schoolId_itemId_key" ON public."PilotChecklistStatus" USING btree ("schoolId", "itemId");


--
-- Name: PipelineLock_expiresAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PipelineLock_expiresAt_idx" ON public."PipelineLock" USING btree ("expiresAt");


--
-- Name: PipelineLock_lockKey_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "PipelineLock_lockKey_key" ON public."PipelineLock" USING btree ("lockKey");


--
-- Name: PlacementTest_studentId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PlacementTest_studentId_createdAt_idx" ON public."PlacementTest" USING btree ("studentId", "createdAt");


--
-- Name: PlacementTest_teacherDecision_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PlacementTest_teacherDecision_createdAt_idx" ON public."PlacementTest" USING btree ("teacherDecision", "createdAt");


--
-- Name: PlatformTransferToken_token_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "PlatformTransferToken_token_key" ON public."PlatformTransferToken" USING btree (token);


--
-- Name: PortfolioCredential_studentId_term_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "PortfolioCredential_studentId_term_key" ON public."PortfolioCredential" USING btree ("studentId", term);


--
-- Name: PortfolioShare_studentId_isActive_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PortfolioShare_studentId_isActive_idx" ON public."PortfolioShare" USING btree ("studentId", "isActive");


--
-- Name: PostChangeEvaluationPlan_changeRequestId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PostChangeEvaluationPlan_changeRequestId_idx" ON public."PostChangeEvaluationPlan" USING btree ("changeRequestId");


--
-- Name: PostChangeEvaluationPlan_status_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PostChangeEvaluationPlan_status_createdAt_idx" ON public."PostChangeEvaluationPlan" USING btree (status, "createdAt");


--
-- Name: PushSubscription_endpoint_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON public."PushSubscription" USING btree (endpoint);


--
-- Name: PushSubscription_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PushSubscription_userId_idx" ON public."PushSubscription" USING btree ("userId");


--
-- Name: QuestionTag_practiceItemId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "QuestionTag_practiceItemId_idx" ON public."QuestionTag" USING btree ("practiceItemId");


--
-- Name: QuestionTag_subject_strandKey_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "QuestionTag_subject_strandKey_idx" ON public."QuestionTag" USING btree (subject, "strandKey");


--
-- Name: RagChunk_schoolId_scope_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "RagChunk_schoolId_scope_idx" ON public."RagChunk" USING btree ("schoolId", scope);


--
-- Name: RagChunk_sourceType_sourceId_chunkIndex_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "RagChunk_sourceType_sourceId_chunkIndex_key" ON public."RagChunk" USING btree ("sourceType", "sourceId", "chunkIndex");


--
-- Name: RagChunk_sourceType_sourceId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "RagChunk_sourceType_sourceId_idx" ON public."RagChunk" USING btree ("sourceType", "sourceId");


--
-- Name: RagChunk_subject_grade_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "RagChunk_subject_grade_idx" ON public."RagChunk" USING btree (subject, grade);


--
-- Name: ReportCard_classId_termId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ReportCard_classId_termId_idx" ON public."ReportCard" USING btree ("classId", "termId");


--
-- Name: ReportCard_schoolId_termId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ReportCard_schoolId_termId_idx" ON public."ReportCard" USING btree ("schoolId", "termId");


--
-- Name: ReportCard_studentId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ReportCard_studentId_status_idx" ON public."ReportCard" USING btree ("studentId", status);


--
-- Name: ReportCard_studentId_termId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "ReportCard_studentId_termId_key" ON public."ReportCard" USING btree ("studentId", "termId");


--
-- Name: ReportDraft_scope_scopeId_periodType_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ReportDraft_scope_scopeId_periodType_createdAt_idx" ON public."ReportDraft" USING btree (scope, "scopeId", "periodType", "createdAt");


--
-- Name: ReviewSchedule_studentId_skillId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "ReviewSchedule_studentId_skillId_key" ON public."ReviewSchedule" USING btree ("studentId", "skillId");


--
-- Name: SMSDeliveryLog_guardianId_messageType_idempotencyKey_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "SMSDeliveryLog_guardianId_messageType_idempotencyKey_key" ON public."SMSDeliveryLog" USING btree ("guardianId", "messageType", "idempotencyKey");


--
-- Name: SMSDeliveryLog_messageType_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SMSDeliveryLog_messageType_createdAt_idx" ON public."SMSDeliveryLog" USING btree ("messageType", "createdAt");


--
-- Name: SMSDeliveryLog_schoolId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SMSDeliveryLog_schoolId_createdAt_idx" ON public."SMSDeliveryLog" USING btree ("schoolId", "createdAt");


--
-- Name: SMSDeliveryLog_status_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SMSDeliveryLog_status_createdAt_idx" ON public."SMSDeliveryLog" USING btree (status, "createdAt");


--
-- Name: ScheduledWork_classId_scheduledDate_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ScheduledWork_classId_scheduledDate_idx" ON public."ScheduledWork" USING btree ("classId", "scheduledDate");


--
-- Name: ScheduledWork_contentId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ScheduledWork_contentId_idx" ON public."ScheduledWork" USING btree ("contentId");


--
-- Name: ScheduledWork_sessionPairId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ScheduledWork_sessionPairId_idx" ON public."ScheduledWork" USING btree ("sessionPairId");


--
-- Name: SchoolEvent_schoolId_eventDate_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SchoolEvent_schoolId_eventDate_idx" ON public."SchoolEvent" USING btree ("schoolId", "eventDate");


--
-- Name: SchoolEvent_schoolId_published_eventDate_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SchoolEvent_schoolId_published_eventDate_idx" ON public."SchoolEvent" USING btree ("schoolId", published, "eventDate");


--
-- Name: SchoolEvent_type_published_eventDate_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SchoolEvent_type_published_eventDate_idx" ON public."SchoolEvent" USING btree (type, published, "eventDate");


--
-- Name: SchoolOnboarding_schoolId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "SchoolOnboarding_schoolId_key" ON public."SchoolOnboarding" USING btree ("schoolId");


--
-- Name: School_code_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "School_code_key" ON public."School" USING btree (code);


--
-- Name: Session_sessionToken_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Session_sessionToken_key" ON public."Session" USING btree ("sessionToken");


--
-- Name: SloEvent_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SloEvent_createdAt_idx" ON public."SloEvent" USING btree ("createdAt");


--
-- Name: SloEvent_schoolId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SloEvent_schoolId_createdAt_idx" ON public."SloEvent" USING btree ("schoolId", "createdAt");


--
-- Name: SloEvent_service_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SloEvent_service_createdAt_idx" ON public."SloEvent" USING btree (service, "createdAt");


--
-- Name: SmsResponse_sessionId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SmsResponse_sessionId_idx" ON public."SmsResponse" USING btree ("sessionId");


--
-- Name: SmsSession_assignmentId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SmsSession_assignmentId_idx" ON public."SmsSession" USING btree ("assignmentId");


--
-- Name: SmsSession_studentPhone_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SmsSession_studentPhone_status_idx" ON public."SmsSession" USING btree ("studentPhone", status);


--
-- Name: StagedRolloutPlan_changeRequestId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "StagedRolloutPlan_changeRequestId_idx" ON public."StagedRolloutPlan" USING btree ("changeRequestId");


--
-- Name: StagedRolloutPlan_status_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "StagedRolloutPlan_status_createdAt_idx" ON public."StagedRolloutPlan" USING btree (status, "createdAt");


--
-- Name: Standard_code_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Standard_code_key" ON public."Standard" USING btree (code);


--
-- Name: Standard_subject_band_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Standard_subject_band_idx" ON public."Standard" USING btree (subject, band);


--
-- Name: StrandCatalog_isActive_subject_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "StrandCatalog_isActive_subject_idx" ON public."StrandCatalog" USING btree ("isActive", subject);


--
-- Name: StrandCatalog_subject_gradeBand_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "StrandCatalog_subject_gradeBand_idx" ON public."StrandCatalog" USING btree (subject, "gradeBand");


--
-- Name: StrandCatalog_subject_strandKey_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "StrandCatalog_subject_strandKey_key" ON public."StrandCatalog" USING btree (subject, "strandKey");


--
-- Name: StuckEvent_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "StuckEvent_createdAt_idx" ON public."StuckEvent" USING btree ("createdAt");


--
-- Name: StuckEvent_studentId_lessonId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "StuckEvent_studentId_lessonId_idx" ON public."StuckEvent" USING btree ("studentId", "lessonId");


--
-- Name: StudentAdaptiveAttempt_studentId_completedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "StudentAdaptiveAttempt_studentId_completedAt_idx" ON public."StudentAdaptiveAttempt" USING btree ("studentId", "completedAt");


--
-- Name: StudentAdaptiveAttempt_studentId_strandCode_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "StudentAdaptiveAttempt_studentId_strandCode_idx" ON public."StudentAdaptiveAttempt" USING btree ("studentId", "strandCode");


--
-- Name: StudentBadgeAward_schoolId_badgeKey_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "StudentBadgeAward_schoolId_badgeKey_idx" ON public."StudentBadgeAward" USING btree ("schoolId", "badgeKey");


--
-- Name: StudentBadgeAward_studentId_awardedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "StudentBadgeAward_studentId_awardedAt_idx" ON public."StudentBadgeAward" USING btree ("studentId", "awardedAt");


--
-- Name: StudentBadgeAward_studentId_badgeKey_criteriaVersion_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "StudentBadgeAward_studentId_badgeKey_criteriaVersion_key" ON public."StudentBadgeAward" USING btree ("studentId", "badgeKey", "criteriaVersion");


--
-- Name: StudentGuardian_studentId_guardianId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "StudentGuardian_studentId_guardianId_key" ON public."StudentGuardian" USING btree ("studentId", "guardianId");


--
-- Name: StudentImportBatch_createdById_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "StudentImportBatch_createdById_createdAt_idx" ON public."StudentImportBatch" USING btree ("createdById", "createdAt");


--
-- Name: StudentImportBatch_schoolId_status_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "StudentImportBatch_schoolId_status_createdAt_idx" ON public."StudentImportBatch" USING btree ("schoolId", status, "createdAt");


--
-- Name: StudentMasteryProfile_masteryState_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "StudentMasteryProfile_masteryState_idx" ON public."StudentMasteryProfile" USING btree ("masteryState");


--
-- Name: StudentMasteryProfile_proficiencyState_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "StudentMasteryProfile_proficiencyState_idx" ON public."StudentMasteryProfile" USING btree ("proficiencyState");


--
-- Name: StudentMasteryProfile_studentId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "StudentMasteryProfile_studentId_idx" ON public."StudentMasteryProfile" USING btree ("studentId");


--
-- Name: StudentMasteryProfile_studentId_lastAssessedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "StudentMasteryProfile_studentId_lastAssessedAt_idx" ON public."StudentMasteryProfile" USING btree ("studentId", "lastAssessedAt");


--
-- Name: StudentMasteryProfile_studentId_subject_strandKey_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "StudentMasteryProfile_studentId_subject_strandKey_key" ON public."StudentMasteryProfile" USING btree ("studentId", subject, "strandKey");


--
-- Name: StudentMasteryProfile_subject_strandKey_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "StudentMasteryProfile_subject_strandKey_idx" ON public."StudentMasteryProfile" USING btree (subject, "strandKey");


--
-- Name: StudentPerformanceEvent_lessonId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "StudentPerformanceEvent_lessonId_idx" ON public."StudentPerformanceEvent" USING btree ("lessonId");


--
-- Name: StudentPerformanceEvent_schoolId_subject_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "StudentPerformanceEvent_schoolId_subject_idx" ON public."StudentPerformanceEvent" USING btree ("schoolId", subject);


--
-- Name: StudentPerformanceEvent_studentId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "StudentPerformanceEvent_studentId_createdAt_idx" ON public."StudentPerformanceEvent" USING btree ("studentId", "createdAt");


--
-- Name: StudentProgress_studentId_scheduledWorkId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "StudentProgress_studentId_scheduledWorkId_key" ON public."StudentProgress" USING btree ("studentId", "scheduledWorkId");


--
-- Name: StudentSession_startedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "StudentSession_startedAt_idx" ON public."StudentSession" USING btree ("startedAt");


--
-- Name: StudentSession_studentId_lessonId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "StudentSession_studentId_lessonId_idx" ON public."StudentSession" USING btree ("studentId", "lessonId");


--
-- Name: StudentStreak_studentId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "StudentStreak_studentId_key" ON public."StudentStreak" USING btree ("studentId");


--
-- Name: Student_humanReadableStudentId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Student_humanReadableStudentId_key" ON public."Student" USING btree ("humanReadableStudentId");


--
-- Name: Student_userId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Student_userId_key" ON public."Student" USING btree ("userId");


--
-- Name: Submission_assessmentId_studentId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Submission_assessmentId_studentId_key" ON public."Submission" USING btree ("assessmentId", "studentId");


--
-- Name: SystemEvent_severity_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SystemEvent_severity_createdAt_idx" ON public."SystemEvent" USING btree (severity, "createdAt");


--
-- Name: SystemEvent_source_eventType_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SystemEvent_source_eventType_idx" ON public."SystemEvent" USING btree (source, "eventType");


--
-- Name: TeacherAction_contentId_occurredAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TeacherAction_contentId_occurredAt_idx" ON public."TeacherAction" USING btree ("contentId", "occurredAt");


--
-- Name: TeacherAction_schoolId_actionType_occurredAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TeacherAction_schoolId_actionType_occurredAt_idx" ON public."TeacherAction" USING btree ("schoolId", "actionType", "occurredAt");


--
-- Name: TeacherAction_studentId_occurredAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TeacherAction_studentId_occurredAt_idx" ON public."TeacherAction" USING btree ("studentId", "occurredAt");


--
-- Name: TeacherAction_teacherUserId_occurredAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TeacherAction_teacherUserId_occurredAt_idx" ON public."TeacherAction" USING btree ("teacherUserId", "occurredAt");


--
-- Name: TeacherAlert_idempotencyKey_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "TeacherAlert_idempotencyKey_key" ON public."TeacherAlert" USING btree ("idempotencyKey") WHERE ("idempotencyKey" IS NOT NULL);


--
-- Name: TeacherAlert_schoolId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TeacherAlert_schoolId_status_idx" ON public."TeacherAlert" USING btree ("schoolId", status);


--
-- Name: TeacherAlert_teacherUserId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TeacherAlert_teacherUserId_status_idx" ON public."TeacherAlert" USING btree ("teacherUserId", status);


--
-- Name: TeacherAssignment_schoolId_classId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TeacherAssignment_schoolId_classId_idx" ON public."TeacherAssignment" USING btree ("schoolId", "classId");


--
-- Name: TeacherAssignment_schoolId_teacherId_classId_subject_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "TeacherAssignment_schoolId_teacherId_classId_subject_key" ON public."TeacherAssignment" USING btree ("schoolId", "teacherId", "classId", subject);


--
-- Name: TeacherAssignment_schoolId_teacherId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TeacherAssignment_schoolId_teacherId_idx" ON public."TeacherAssignment" USING btree ("schoolId", "teacherId");


--
-- Name: TeacherLessonAssignment_classId_scheduledFor_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TeacherLessonAssignment_classId_scheduledFor_idx" ON public."TeacherLessonAssignment" USING btree ("classId", "scheduledFor");


--
-- Name: TeacherMorningBrief_schoolId_briefDate_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TeacherMorningBrief_schoolId_briefDate_idx" ON public."TeacherMorningBrief" USING btree ("schoolId", "briefDate");


--
-- Name: TeacherMorningBrief_teacherUserId_briefDate_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "TeacherMorningBrief_teacherUserId_briefDate_key" ON public."TeacherMorningBrief" USING btree ("teacherUserId", "briefDate");


--
-- Name: TeacherProfile_schoolId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TeacherProfile_schoolId_idx" ON public."TeacherProfile" USING btree ("schoolId");


--
-- Name: TeacherProfile_userId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "TeacherProfile_userId_key" ON public."TeacherProfile" USING btree ("userId");


--
-- Name: TeacherSentiment_schoolId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TeacherSentiment_schoolId_createdAt_idx" ON public."TeacherSentiment" USING btree ("schoolId", "createdAt");


--
-- Name: TeacherSentiment_teacherId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TeacherSentiment_teacherId_createdAt_idx" ON public."TeacherSentiment" USING btree ("teacherId", "createdAt");


--
-- Name: TeachingLedger_facilitatorId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TeachingLedger_facilitatorId_createdAt_idx" ON public."TeachingLedger" USING btree ("facilitatorId", "createdAt");


--
-- Name: TeachingLedger_schoolId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TeachingLedger_schoolId_createdAt_idx" ON public."TeachingLedger" USING btree ("schoolId", "createdAt");


--
-- Name: TeachingLedger_sessionId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "TeachingLedger_sessionId_key" ON public."TeachingLedger" USING btree ("sessionId");


--
-- Name: TeachingSession_contentId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TeachingSession_contentId_idx" ON public."TeachingSession" USING btree ("contentId");


--
-- Name: TeachingSession_facilitatorId_startedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TeachingSession_facilitatorId_startedAt_idx" ON public."TeachingSession" USING btree ("facilitatorId", "startedAt");


--
-- Name: TeachingSession_schoolId_startedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TeachingSession_schoolId_startedAt_idx" ON public."TeachingSession" USING btree ("schoolId", "startedAt");


--
-- Name: TeachingTurn_sessionId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TeachingTurn_sessionId_createdAt_idx" ON public."TeachingTurn" USING btree ("sessionId", "createdAt");


--
-- Name: TeachingTurn_sessionId_turnIndex_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "TeachingTurn_sessionId_turnIndex_key" ON public."TeachingTurn" USING btree ("sessionId", "turnIndex");


--
-- Name: Term_academicYearId_name_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Term_academicYearId_name_key" ON public."Term" USING btree ("academicYearId", name);


--
-- Name: Term_academicYearId_startDate_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Term_academicYearId_startDate_idx" ON public."Term" USING btree ("academicYearId", "startDate");


--
-- Name: TextbookGenerationJob_generatedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TextbookGenerationJob_generatedAt_idx" ON public."TextbookGenerationJob" USING btree ("generatedAt");


--
-- Name: TextbookGenerationJob_grade_subject_format_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TextbookGenerationJob_grade_subject_format_idx" ON public."TextbookGenerationJob" USING btree (grade, subject, format);


--
-- Name: TextbookGenerationJob_grade_subject_format_version_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "TextbookGenerationJob_grade_subject_format_version_key" ON public."TextbookGenerationJob" USING btree (grade, subject, format, version);


--
-- Name: TextbookGenerationJob_status_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TextbookGenerationJob_status_createdAt_idx" ON public."TextbookGenerationJob" USING btree (status, "createdAt");


--
-- Name: TimetableAssignment_assignedDate_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TimetableAssignment_assignedDate_idx" ON public."TimetableAssignment" USING btree ("assignedDate");


--
-- Name: TimetableAssignment_timetableId_assignedDate_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TimetableAssignment_timetableId_assignedDate_idx" ON public."TimetableAssignment" USING btree ("timetableId", "assignedDate");


--
-- Name: Timetable_classId_dayOfWeek_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Timetable_classId_dayOfWeek_idx" ON public."Timetable" USING btree ("classId", "dayOfWeek");


--
-- Name: Timetable_schoolId_classId_dayOfWeek_periodLabel_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Timetable_schoolId_classId_dayOfWeek_periodLabel_key" ON public."Timetable" USING btree ("schoolId", "classId", "dayOfWeek", "periodLabel");


--
-- Name: Timetable_schoolId_dayOfWeek_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Timetable_schoolId_dayOfWeek_idx" ON public."Timetable" USING btree ("schoolId", "dayOfWeek");


--
-- Name: Timetable_teacherId_dayOfWeek_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Timetable_teacherId_dayOfWeek_idx" ON public."Timetable" USING btree ("teacherId", "dayOfWeek");


--
-- Name: TrainingModule_code_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "TrainingModule_code_key" ON public."TrainingModule" USING btree (code);


--
-- Name: TrainingModule_isActive_sortOrder_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TrainingModule_isActive_sortOrder_idx" ON public."TrainingModule" USING btree ("isActive", "sortOrder");


--
-- Name: TrainingProgress_moduleId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TrainingProgress_moduleId_status_idx" ON public."TrainingProgress" USING btree ("moduleId", status);


--
-- Name: TrainingProgress_teacherUserId_moduleId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "TrainingProgress_teacherUserId_moduleId_key" ON public."TrainingProgress" USING btree ("teacherUserId", "moduleId");


--
-- Name: TrainingProgress_teacherUserId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TrainingProgress_teacherUserId_status_idx" ON public."TrainingProgress" USING btree ("teacherUserId", status);


--
-- Name: Transcript_schoolId_academicYearId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Transcript_schoolId_academicYearId_idx" ON public."Transcript" USING btree ("schoolId", "academicYearId");


--
-- Name: Transcript_studentId_academicYearId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Transcript_studentId_academicYearId_key" ON public."Transcript" USING btree ("studentId", "academicYearId");


--
-- Name: Transcript_studentId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Transcript_studentId_createdAt_idx" ON public."Transcript" USING btree ("studentId", "createdAt");


--
-- Name: TrendSnapshot_bucket_scope_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TrendSnapshot_bucket_scope_idx" ON public."TrendSnapshot" USING btree (bucket, scope);


--
-- Name: TrendSnapshot_scope_scopeKey_bucket_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "TrendSnapshot_scope_scopeKey_bucket_key" ON public."TrendSnapshot" USING btree (scope, "scopeKey", bucket);


--
-- Name: TrendSnapshot_scope_scopeKey_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TrendSnapshot_scope_scopeKey_idx" ON public."TrendSnapshot" USING btree (scope, "scopeKey");


--
-- Name: TutorConversation_studentId_contentId_sessionDate_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TutorConversation_studentId_contentId_sessionDate_idx" ON public."TutorConversation" USING btree ("studentId", "contentId", "sessionDate");


--
-- Name: User_email_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "User_email_key" ON public."User" USING btree (email);


--
-- Name: User_googleId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "User_googleId_key" ON public."User" USING btree ("googleId");


--
-- Name: VerificationToken_identifier_token_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON public."VerificationToken" USING btree (identifier, token);


--
-- Name: VerificationToken_token_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "VerificationToken_token_key" ON public."VerificationToken" USING btree (token);


--
-- Name: VideoWatchEvent_studentId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "VideoWatchEvent_studentId_idx" ON public."VideoWatchEvent" USING btree ("studentId");


--
-- Name: VideoWatchEvent_videoId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "VideoWatchEvent_videoId_idx" ON public."VideoWatchEvent" USING btree ("videoId");


--
-- Name: VirtualLab_schoolId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "VirtualLab_schoolId_idx" ON public."VirtualLab" USING btree ("schoolId");


--
-- Name: VirtualLab_status_grade_schoolId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "VirtualLab_status_grade_schoolId_idx" ON public."VirtualLab" USING btree (status, grade, "schoolId");


--
-- Name: VirtualLab_subject_grade_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "VirtualLab_subject_grade_status_idx" ON public."VirtualLab" USING btree (subject, grade, status);


--
-- Name: WaecPracticeItem_subjectId_topicId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "WaecPracticeItem_subjectId_topicId_idx" ON public."WaecPracticeItem" USING btree ("subjectId", "topicId");


--
-- Name: WeeklyLeaderboard_classId_weekStart_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "WeeklyLeaderboard_classId_weekStart_idx" ON public."WeeklyLeaderboard" USING btree ("classId", "weekStart");


--
-- Name: WeeklyLeaderboard_classId_weekStart_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "WeeklyLeaderboard_classId_weekStart_key" ON public."WeeklyLeaderboard" USING btree ("classId", "weekStart");


--
-- Name: WorkflowCheckpoint_idempotencyKey_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "WorkflowCheckpoint_idempotencyKey_key" ON public."WorkflowCheckpoint" USING btree ("idempotencyKey");


--
-- Name: WorkflowCheckpoint_traceId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "WorkflowCheckpoint_traceId_createdAt_idx" ON public."WorkflowCheckpoint" USING btree ("traceId", "createdAt");


--
-- Name: WorkflowCheckpoint_workflowRunId_checkpointKey_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "WorkflowCheckpoint_workflowRunId_checkpointKey_createdAt_idx" ON public."WorkflowCheckpoint" USING btree ("workflowRunId", "checkpointKey", "createdAt");


--
-- Name: WorkflowCheckpoint_workflowRunId_sequence_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "WorkflowCheckpoint_workflowRunId_sequence_idx" ON public."WorkflowCheckpoint" USING btree ("workflowRunId", sequence);


--
-- Name: WorkflowRun_correlationId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "WorkflowRun_correlationId_createdAt_idx" ON public."WorkflowRun" USING btree ("correlationId", "createdAt");


--
-- Name: WorkflowRun_districtId_status_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "WorkflowRun_districtId_status_createdAt_idx" ON public."WorkflowRun" USING btree ("districtId", status, "createdAt");


--
-- Name: WorkflowRun_idempotencyKey_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "WorkflowRun_idempotencyKey_key" ON public."WorkflowRun" USING btree ("idempotencyKey");


--
-- Name: WorkflowRun_lockedUntil_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "WorkflowRun_lockedUntil_idx" ON public."WorkflowRun" USING btree ("lockedUntil");


--
-- Name: WorkflowRun_nextRetryAt_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "WorkflowRun_nextRetryAt_status_idx" ON public."WorkflowRun" USING btree ("nextRetryAt", status);


--
-- Name: WorkflowRun_partitionKey_status_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "WorkflowRun_partitionKey_status_createdAt_idx" ON public."WorkflowRun" USING btree ("partitionKey", status, "createdAt");


--
-- Name: WorkflowRun_replayOfRunId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "WorkflowRun_replayOfRunId_idx" ON public."WorkflowRun" USING btree ("replayOfRunId");


--
-- Name: WorkflowRun_schoolId_status_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "WorkflowRun_schoolId_status_createdAt_idx" ON public."WorkflowRun" USING btree ("schoolId", status, "createdAt");


--
-- Name: WorkflowRun_tenantId_status_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "WorkflowRun_tenantId_status_createdAt_idx" ON public."WorkflowRun" USING btree ("tenantId", status, "createdAt");


--
-- Name: WorkflowRun_traceId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "WorkflowRun_traceId_key" ON public."WorkflowRun" USING btree ("traceId");


--
-- Name: WorkflowRun_triggerEventId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "WorkflowRun_triggerEventId_idx" ON public."WorkflowRun" USING btree ("triggerEventId");


--
-- Name: WorkflowRun_workflowType_status_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "WorkflowRun_workflowType_status_createdAt_idx" ON public."WorkflowRun" USING btree ("workflowType", status, "createdAt");


--
-- Name: WorkflowStep_idempotencyKey_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "WorkflowStep_idempotencyKey_key" ON public."WorkflowStep" USING btree ("idempotencyKey");


--
-- Name: WorkflowStep_nextRetryAt_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "WorkflowStep_nextRetryAt_status_idx" ON public."WorkflowStep" USING btree ("nextRetryAt", status);


--
-- Name: WorkflowStep_stepKey_status_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "WorkflowStep_stepKey_status_createdAt_idx" ON public."WorkflowStep" USING btree ("stepKey", status, "createdAt");


--
-- Name: WorkflowStep_workflowRunId_sequence_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "WorkflowStep_workflowRunId_sequence_idx" ON public."WorkflowStep" USING btree ("workflowRunId", sequence);


--
-- Name: WorkflowStep_workflowRunId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "WorkflowStep_workflowRunId_status_idx" ON public."WorkflowStep" USING btree ("workflowRunId", status);


--
-- Name: _SkillToStandard_B_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "_SkillToStandard_B_index" ON public."_SkillToStandard" USING btree ("B");


--
-- Name: curriculum_content_embedding_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX curriculum_content_embedding_idx ON public."CurriculumContent" USING ivfflat (embedding public.vector_cosine_ops) WITH (lists='100');


--
-- Name: curriculum_content_fts; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX curriculum_content_fts ON public."CurriculumContent" USING gin (to_tsvector('english'::regconfig, ((COALESCE(title, ''::text) || ' '::text) || COALESCE(subject, ''::text))));


--
-- Name: rag_chunk_embedding_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX rag_chunk_embedding_idx ON public."RagChunk" USING ivfflat (embedding public.vector_cosine_ops) WITH (lists='100');


--
-- Name: school_event_fts; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX school_event_fts ON public."SchoolEvent" USING gin (to_tsvector('english'::regconfig, ((COALESCE(title, ''::text) || ' '::text) || COALESCE(description, ''::text))));


--
-- Name: AuditLog audit_log_no_delete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_log_no_delete BEFORE DELETE ON public."AuditLog" FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_delete();


--
-- Name: AuditLog audit_log_no_update; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_log_no_update BEFORE UPDATE ON public."AuditLog" FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_update();


--
-- Name: AcademicEnrollment AcademicEnrollment_academicYearId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AcademicEnrollment"
    ADD CONSTRAINT "AcademicEnrollment_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES public."AcademicYear"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AcademicEnrollment AcademicEnrollment_schoolId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AcademicEnrollment"
    ADD CONSTRAINT "AcademicEnrollment_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES public."School"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AcademicEnrollment AcademicEnrollment_studentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AcademicEnrollment"
    ADD CONSTRAINT "AcademicEnrollment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES public."Student"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AcademicYear AcademicYear_schoolId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AcademicYear"
    ADD CONSTRAINT "AcademicYear_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES public."School"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Account Account_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Account"
    ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AdaptiveMasteryRecord AdaptiveMasteryRecord_studentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AdaptiveMasteryRecord"
    ADD CONSTRAINT "AdaptiveMasteryRecord_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES public."Student"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AgentInvocation AgentInvocation_goalId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AgentInvocation"
    ADD CONSTRAINT "AgentInvocation_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES public."AgentGoal"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: AgentMetric AgentMetric_agentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AgentMetric"
    ADD CONSTRAINT "AgentMetric_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES public."Agent"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: AgentTask AgentTask_agentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AgentTask"
    ADD CONSTRAINT "AgentTask_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES public."Agent"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Announcement Announcement_createdBy_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Announcement"
    ADD CONSTRAINT "Announcement_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Announcement Announcement_schoolId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Announcement"
    ADD CONSTRAINT "Announcement_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES public."School"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AssessmentAttemptDetail AssessmentAttemptDetail_attemptId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AssessmentAttemptDetail"
    ADD CONSTRAINT "AssessmentAttemptDetail_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES public."AssessmentAttempt"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AssessmentItem AssessmentItem_assessmentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AssessmentItem"
    ADD CONSTRAINT "AssessmentItem_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES public."Assessment"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: AssessmentItem AssessmentItem_practiceItemId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AssessmentItem"
    ADD CONSTRAINT "AssessmentItem_practiceItemId_fkey" FOREIGN KEY ("practiceItemId") REFERENCES public."PracticeItem"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Assessment Assessment_classId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Assessment"
    ADD CONSTRAINT "Assessment_classId_fkey" FOREIGN KEY ("classId") REFERENCES public."Class"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Assessment Assessment_unitId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Assessment"
    ADD CONSTRAINT "Assessment_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES public."Unit"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: AssignmentSubmission AssignmentSubmission_assignmentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AssignmentSubmission"
    ADD CONSTRAINT "AssignmentSubmission_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES public."Assignment"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: AssignmentSubmission AssignmentSubmission_studentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AssignmentSubmission"
    ADD CONSTRAINT "AssignmentSubmission_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES public."Student"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: AssignmentSuggestion AssignmentSuggestion_schoolId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AssignmentSuggestion"
    ADD CONSTRAINT "AssignmentSuggestion_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES public."School"(id);


--
-- Name: Assignment Assignment_classId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Assignment"
    ADD CONSTRAINT "Assignment_classId_fkey" FOREIGN KEY ("classId") REFERENCES public."Class"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: AttendanceRecord AttendanceRecord_meetingId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AttendanceRecord"
    ADD CONSTRAINT "AttendanceRecord_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES public."Meeting"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: AttendanceRecord AttendanceRecord_studentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AttendanceRecord"
    ADD CONSTRAINT "AttendanceRecord_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES public."Student"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Attendance Attendance_classId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Attendance"
    ADD CONSTRAINT "Attendance_classId_fkey" FOREIGN KEY ("classId") REFERENCES public."Class"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Attendance Attendance_markedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Attendance"
    ADD CONSTRAINT "Attendance_markedById_fkey" FOREIGN KEY ("markedById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Attendance Attendance_schoolId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Attendance"
    ADD CONSTRAINT "Attendance_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES public."School"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Attendance Attendance_studentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Attendance"
    ADD CONSTRAINT "Attendance_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES public."Student"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AuditLog AuditLog_schoolId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AuditLog"
    ADD CONSTRAINT "AuditLog_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES public."School"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: AuditLog AuditLog_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AuditLog"
    ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: CapstoneProject CapstoneProject_studentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CapstoneProject"
    ADD CONSTRAINT "CapstoneProject_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES public."Student"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: CapstoneProject CapstoneProject_teacherId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CapstoneProject"
    ADD CONSTRAINT "CapstoneProject_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: CertificateShare CertificateShare_certificateId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CertificateShare"
    ADD CONSTRAINT "CertificateShare_certificateId_fkey" FOREIGN KEY ("certificateId") REFERENCES public."Certificate"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Certificate Certificate_schoolId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Certificate"
    ADD CONSTRAINT "Certificate_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES public."School"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Certificate Certificate_studentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Certificate"
    ADD CONSTRAINT "Certificate_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES public."Student"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ChangeRequestSignoff ChangeRequestSignoff_changeRequestId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ChangeRequestSignoff"
    ADD CONSTRAINT "ChangeRequestSignoff_changeRequestId_fkey" FOREIGN KEY ("changeRequestId") REFERENCES public."OptimizationChangeRequest"(id);


--
-- Name: ChatMessage ChatMessage_studentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ChatMessage"
    ADD CONSTRAINT "ChatMessage_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES public."Student"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Class Class_schoolId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Class"
    ADD CONSTRAINT "Class_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES public."School"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Class Class_teacherId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Class"
    ADD CONSTRAINT "Class_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: ConfusionSignal ConfusionSignal_studentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ConfusionSignal"
    ADD CONSTRAINT "ConfusionSignal_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES public."Student"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: CurriculumContent CurriculumContent_editedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CurriculumContent"
    ADD CONSTRAINT "CurriculumContent_editedById_fkey" FOREIGN KEY ("editedById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: CurriculumContent CurriculumContent_versionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CurriculumContent"
    ADD CONSTRAINT "CurriculumContent_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES public."CurriculumVersion"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: CurriculumLessonPlan CurriculumLessonPlan_curriculumContentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CurriculumLessonPlan"
    ADD CONSTRAINT "CurriculumLessonPlan_curriculumContentId_fkey" FOREIGN KEY ("curriculumContentId") REFERENCES public."CurriculumContent"("contentId") ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: CurriculumLessonPlan CurriculumLessonPlan_weekId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CurriculumLessonPlan"
    ADD CONSTRAINT "CurriculumLessonPlan_weekId_fkey" FOREIGN KEY ("weekId") REFERENCES public."CurriculumWeek"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: CurriculumRegenerationCheckpoint CurriculumRegenerationCheckpoint_runId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CurriculumRegenerationCheckpoint"
    ADD CONSTRAINT "CurriculumRegenerationCheckpoint_runId_fkey" FOREIGN KEY ("runId") REFERENCES public."CurriculumRegenerationRun"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: CurriculumRegenerationJob CurriculumRegenerationJob_runId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CurriculumRegenerationJob"
    ADD CONSTRAINT "CurriculumRegenerationJob_runId_fkey" FOREIGN KEY ("runId") REFERENCES public."CurriculumRegenerationRun"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: CurriculumUnit CurriculumUnit_academicYearId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CurriculumUnit"
    ADD CONSTRAINT "CurriculumUnit_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES public."AcademicYear"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: CurriculumUnit CurriculumUnit_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CurriculumUnit"
    ADD CONSTRAINT "CurriculumUnit_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES public."User"(id);


--
-- Name: CurriculumUnit CurriculumUnit_schoolId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CurriculumUnit"
    ADD CONSTRAINT "CurriculumUnit_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES public."School"(id);


--
-- Name: CurriculumVersion CurriculumVersion_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CurriculumVersion"
    ADD CONSTRAINT "CurriculumVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: CurriculumWeek CurriculumWeek_unitId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CurriculumWeek"
    ADD CONSTRAINT "CurriculumWeek_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES public."CurriculumUnit"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: DiscussionLastRead DiscussionLastRead_threadId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DiscussionLastRead"
    ADD CONSTRAINT "DiscussionLastRead_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES public."DiscussionThread"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: DiscussionLastRead DiscussionLastRead_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DiscussionLastRead"
    ADD CONSTRAINT "DiscussionLastRead_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: DiscussionPost DiscussionPost_authorId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DiscussionPost"
    ADD CONSTRAINT "DiscussionPost_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: DiscussionPost DiscussionPost_parentPostId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DiscussionPost"
    ADD CONSTRAINT "DiscussionPost_parentPostId_fkey" FOREIGN KEY ("parentPostId") REFERENCES public."DiscussionPost"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: DiscussionPost DiscussionPost_threadId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DiscussionPost"
    ADD CONSTRAINT "DiscussionPost_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES public."DiscussionThread"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: DiscussionThread DiscussionThread_authorId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DiscussionThread"
    ADD CONSTRAINT "DiscussionThread_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: DiscussionThread DiscussionThread_classId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DiscussionThread"
    ADD CONSTRAINT "DiscussionThread_classId_fkey" FOREIGN KEY ("classId") REFERENCES public."Class"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: DiscussionUpvote DiscussionUpvote_postId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DiscussionUpvote"
    ADD CONSTRAINT "DiscussionUpvote_postId_fkey" FOREIGN KEY ("postId") REFERENCES public."DiscussionPost"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: DiscussionUpvote DiscussionUpvote_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DiscussionUpvote"
    ADD CONSTRAINT "DiscussionUpvote_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Enrollment Enrollment_classId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Enrollment"
    ADD CONSTRAINT "Enrollment_classId_fkey" FOREIGN KEY ("classId") REFERENCES public."Class"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Enrollment Enrollment_studentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Enrollment"
    ADD CONSTRAINT "Enrollment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES public."Student"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ExamAttempt ExamAttempt_examId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ExamAttempt"
    ADD CONSTRAINT "ExamAttempt_examId_fkey" FOREIGN KEY ("examId") REFERENCES public."Exam"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ExamAttempt ExamAttempt_studentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ExamAttempt"
    ADD CONSTRAINT "ExamAttempt_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES public."Student"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ExamCertification ExamCertification_examId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ExamCertification"
    ADD CONSTRAINT "ExamCertification_examId_fkey" FOREIGN KEY ("examId") REFERENCES public."Exam"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ExamCertification ExamCertification_studentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ExamCertification"
    ADD CONSTRAINT "ExamCertification_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES public."Student"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ExamQuestion ExamQuestion_examId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ExamQuestion"
    ADD CONSTRAINT "ExamQuestion_examId_fkey" FOREIGN KEY ("examId") REFERENCES public."Exam"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Exam Exam_academicYearId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Exam"
    ADD CONSTRAINT "Exam_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES public."AcademicYear"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Exam Exam_classId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Exam"
    ADD CONSTRAINT "Exam_classId_fkey" FOREIGN KEY ("classId") REFERENCES public."Class"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Exam Exam_schoolId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Exam"
    ADD CONSTRAINT "Exam_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES public."School"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ExportRecord ExportRecord_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ExportRecord"
    ADD CONSTRAINT "ExportRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: GeneratedDocument GeneratedDocument_requestedBy_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."GeneratedDocument"
    ADD CONSTRAINT "GeneratedDocument_requestedBy_fkey" FOREIGN KEY ("requestedBy") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: GeneratedDocument GeneratedDocument_schoolId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."GeneratedDocument"
    ADD CONSTRAINT "GeneratedDocument_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES public."School"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: GeneratedDocument GeneratedDocument_studentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."GeneratedDocument"
    ADD CONSTRAINT "GeneratedDocument_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Grade Grade_classId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Grade"
    ADD CONSTRAINT "Grade_classId_fkey" FOREIGN KEY ("classId") REFERENCES public."Class"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Grade Grade_studentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Grade"
    ADD CONSTRAINT "Grade_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES public."Student"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: GradedSubmission GradedSubmission_studentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."GradedSubmission"
    ADD CONSTRAINT "GradedSubmission_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES public."Student"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: GuardianConsent GuardianConsent_guardianId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."GuardianConsent"
    ADD CONSTRAINT "GuardianConsent_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: GuardianConsent GuardianConsent_schoolId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."GuardianConsent"
    ADD CONSTRAINT "GuardianConsent_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES public."School"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: GuardianConsent GuardianConsent_studentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."GuardianConsent"
    ADD CONSTRAINT "GuardianConsent_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES public."Student"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: GuardianMessage GuardianMessage_guardianId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."GuardianMessage"
    ADD CONSTRAINT "GuardianMessage_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: GuardianMessage GuardianMessage_schoolId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."GuardianMessage"
    ADD CONSTRAINT "GuardianMessage_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES public."School"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: GuardianMessage GuardianMessage_studentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."GuardianMessage"
    ADD CONSTRAINT "GuardianMessage_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES public."Student"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: GuardianMessage GuardianMessage_teacherId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."GuardianMessage"
    ADD CONSTRAINT "GuardianMessage_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: HomeworkSubmission HomeworkSubmission_homeworkId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."HomeworkSubmission"
    ADD CONSTRAINT "HomeworkSubmission_homeworkId_fkey" FOREIGN KEY ("homeworkId") REFERENCES public."Homework"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: HomeworkSubmission HomeworkSubmission_studentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."HomeworkSubmission"
    ADD CONSTRAINT "HomeworkSubmission_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES public."Student"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Homework Homework_classId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Homework"
    ADD CONSTRAINT "Homework_classId_fkey" FOREIGN KEY ("classId") REFERENCES public."Class"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Homework Homework_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Homework"
    ADD CONSTRAINT "Homework_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: InterventionLog InterventionLog_districtId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."InterventionLog"
    ADD CONSTRAINT "InterventionLog_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES public."District"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: InterventionLog InterventionLog_schoolId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."InterventionLog"
    ADD CONSTRAINT "InterventionLog_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES public."School"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: InterventionRecommendation InterventionRecommendation_studentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."InterventionRecommendation"
    ADD CONSTRAINT "InterventionRecommendation_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES public."Student"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: InviteToken InviteToken_schoolId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."InviteToken"
    ADD CONSTRAINT "InviteToken_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES public."School"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: InviteToken InviteToken_studentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."InviteToken"
    ADD CONSTRAINT "InviteToken_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES public."Student"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: LabSession LabSession_schoolId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."LabSession"
    ADD CONSTRAINT "LabSession_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES public."School"(id);


--
-- Name: LabSession LabSession_studentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."LabSession"
    ADD CONSTRAINT "LabSession_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES public."User"(id);


--
-- Name: LeagueSnapshot LeagueSnapshot_schoolId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."LeagueSnapshot"
    ADD CONSTRAINT "LeagueSnapshot_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES public."School"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: LearningPathQueue LearningPathQueue_studentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."LearningPathQueue"
    ADD CONSTRAINT "LearningPathQueue_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES public."Student"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: LessonAudio LessonAudio_lessonId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."LessonAudio"
    ADD CONSTRAINT "LessonAudio_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES public."CurriculumContent"("contentId") ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: LessonHelpFlag LessonHelpFlag_contentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."LessonHelpFlag"
    ADD CONSTRAINT "LessonHelpFlag_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES public."CurriculumContent"("contentId") ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: LessonHelpFlag LessonHelpFlag_studentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."LessonHelpFlag"
    ADD CONSTRAINT "LessonHelpFlag_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: LessonShare LessonShare_lessonId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."LessonShare"
    ADD CONSTRAINT "LessonShare_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES public."CurriculumContent"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: LessonShare LessonShare_schoolId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."LessonShare"
    ADD CONSTRAINT "LessonShare_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES public."School"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: LessonShare LessonShare_sharedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."LessonShare"
    ADD CONSTRAINT "LessonShare_sharedById_fkey" FOREIGN KEY ("sharedById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: LessonVersion LessonVersion_authorId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."LessonVersion"
    ADD CONSTRAINT "LessonVersion_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: LessonVersion LessonVersion_lessonId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."LessonVersion"
    ADD CONSTRAINT "LessonVersion_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES public."CurriculumContent"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: LessonVideo LessonVideo_lessonId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."LessonVideo"
    ADD CONSTRAINT "LessonVideo_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES public."CurriculumContent"("contentId") ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: LessonVideo LessonVideo_uploadedBy_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."LessonVideo"
    ADD CONSTRAINT "LessonVideo_uploadedBy_fkey" FOREIGN KEY ("uploadedBy") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Lesson Lesson_unitId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Lesson"
    ADD CONSTRAINT "Lesson_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES public."Unit"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: MasteryRecord MasteryRecord_skillId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MasteryRecord"
    ADD CONSTRAINT "MasteryRecord_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES public."Skill"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: MasteryRecord MasteryRecord_studentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MasteryRecord"
    ADD CONSTRAINT "MasteryRecord_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES public."Student"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: MeetingAttendee MeetingAttendee_meetingId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MeetingAttendee"
    ADD CONSTRAINT "MeetingAttendee_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES public."Meeting"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: MeetingAttendee MeetingAttendee_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MeetingAttendee"
    ADD CONSTRAINT "MeetingAttendee_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Meeting Meeting_classId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Meeting"
    ADD CONSTRAINT "Meeting_classId_fkey" FOREIGN KEY ("classId") REFERENCES public."Class"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Meeting Meeting_hostUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Meeting"
    ADD CONSTRAINT "Meeting_hostUserId_fkey" FOREIGN KEY ("hostUserId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: MessageReadReceipt MessageReadReceipt_messageId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MessageReadReceipt"
    ADD CONSTRAINT "MessageReadReceipt_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES public."Message"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: MessageReadReceipt MessageReadReceipt_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MessageReadReceipt"
    ADD CONSTRAINT "MessageReadReceipt_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Message Message_classId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Message"
    ADD CONSTRAINT "Message_classId_fkey" FOREIGN KEY ("classId") REFERENCES public."Class"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Message Message_fromUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Message"
    ADD CONSTRAINT "Message_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Message Message_toUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Message"
    ADD CONSTRAINT "Message_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: MetricEvent MetricEvent_schoolId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MetricEvent"
    ADD CONSTRAINT "MetricEvent_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES public."School"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: MetricEvent MetricEvent_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MetricEvent"
    ADD CONSTRAINT "MetricEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: MoeDirectiveApplication MoeDirectiveApplication_classId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MoeDirectiveApplication"
    ADD CONSTRAINT "MoeDirectiveApplication_classId_fkey" FOREIGN KEY ("classId") REFERENCES public."Class"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: MoeDirectiveApplication MoeDirectiveApplication_directiveId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MoeDirectiveApplication"
    ADD CONSTRAINT "MoeDirectiveApplication_directiveId_fkey" FOREIGN KEY ("directiveId") REFERENCES public."MoePolicyDirective"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: MoeDirectiveApplication MoeDirectiveApplication_schoolId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MoeDirectiveApplication"
    ADD CONSTRAINT "MoeDirectiveApplication_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES public."School"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: MoePolicyDirective MoePolicyDirective_approvedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MoePolicyDirective"
    ADD CONSTRAINT "MoePolicyDirective_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: MoePolicyDirective MoePolicyDirective_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MoePolicyDirective"
    ADD CONSTRAINT "MoePolicyDirective_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: MoePolicyDirective MoePolicyDirective_districtId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MoePolicyDirective"
    ADD CONSTRAINT "MoePolicyDirective_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES public."District"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: MoePolicyDirective MoePolicyDirective_schoolId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MoePolicyDirective"
    ADD CONSTRAINT "MoePolicyDirective_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES public."School"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: MoePolicyDirective MoePolicyDirective_updatedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MoePolicyDirective"
    ADD CONSTRAINT "MoePolicyDirective_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: MoeSubmission MoeSubmission_schoolId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MoeSubmission"
    ADD CONSTRAINT "MoeSubmission_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES public."School"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: NotificationInboxItem NotificationInboxItem_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."NotificationInboxItem"
    ADD CONSTRAINT "NotificationInboxItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: NotificationLog NotificationLog_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."NotificationLog"
    ADD CONSTRAINT "NotificationLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: PartnerContact PartnerContact_partnerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PartnerContact"
    ADD CONSTRAINT "PartnerContact_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES public."Partner"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: PartnerProgram PartnerProgram_partnerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PartnerProgram"
    ADD CONSTRAINT "PartnerProgram_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES public."Partner"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: PasswordResetToken PasswordResetToken_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PasswordResetToken"
    ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: PilotChecklistStatus PilotChecklistStatus_itemId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PilotChecklistStatus"
    ADD CONSTRAINT "PilotChecklistStatus_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES public."PilotChecklistItem"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: PilotChecklistStatus PilotChecklistStatus_schoolId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PilotChecklistStatus"
    ADD CONSTRAINT "PilotChecklistStatus_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES public."School"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: PlacementTest PlacementTest_studentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PlacementTest"
    ADD CONSTRAINT "PlacementTest_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES public."Student"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: PortfolioCredential PortfolioCredential_studentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PortfolioCredential"
    ADD CONSTRAINT "PortfolioCredential_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: PortfolioItem PortfolioItem_capstoneProjectId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PortfolioItem"
    ADD CONSTRAINT "PortfolioItem_capstoneProjectId_fkey" FOREIGN KEY ("capstoneProjectId") REFERENCES public."CapstoneProject"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: PortfolioItem PortfolioItem_studentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PortfolioItem"
    ADD CONSTRAINT "PortfolioItem_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES public."Student"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: PortfolioShare PortfolioShare_studentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PortfolioShare"
    ADD CONSTRAINT "PortfolioShare_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES public."Student"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: PostChangeEvaluationPlan PostChangeEvaluationPlan_changeRequestId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PostChangeEvaluationPlan"
    ADD CONSTRAINT "PostChangeEvaluationPlan_changeRequestId_fkey" FOREIGN KEY ("changeRequestId") REFERENCES public."OptimizationChangeRequest"(id);


--
-- Name: PracticeItem PracticeItem_skillId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PracticeItem"
    ADD CONSTRAINT "PracticeItem_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES public."Skill"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: PushSubscription PushSubscription_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PushSubscription"
    ADD CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: QuestionTag QuestionTag_practiceItemId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."QuestionTag"
    ADD CONSTRAINT "QuestionTag_practiceItemId_fkey" FOREIGN KEY ("practiceItemId") REFERENCES public."PracticeItem"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: QuestionTag QuestionTag_subject_strandKey_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."QuestionTag"
    ADD CONSTRAINT "QuestionTag_subject_strandKey_fkey" FOREIGN KEY (subject, "strandKey") REFERENCES public."StrandCatalog"(subject, "strandKey") ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: RagChunk RagChunk_schoolId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RagChunk"
    ADD CONSTRAINT "RagChunk_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES public."School"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ReportCard ReportCard_createdBy_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ReportCard"
    ADD CONSTRAINT "ReportCard_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ReportCard ReportCard_studentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ReportCard"
    ADD CONSTRAINT "ReportCard_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES public."Student"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ReportCard ReportCard_termId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ReportCard"
    ADD CONSTRAINT "ReportCard_termId_fkey" FOREIGN KEY ("termId") REFERENCES public."Term"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ReviewSchedule ReviewSchedule_skillId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ReviewSchedule"
    ADD CONSTRAINT "ReviewSchedule_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES public."Skill"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ReviewSchedule ReviewSchedule_studentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ReviewSchedule"
    ADD CONSTRAINT "ReviewSchedule_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES public."Student"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: SMSDeliveryLog SMSDeliveryLog_guardianId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SMSDeliveryLog"
    ADD CONSTRAINT "SMSDeliveryLog_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: SMSDeliveryLog SMSDeliveryLog_schoolId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SMSDeliveryLog"
    ADD CONSTRAINT "SMSDeliveryLog_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES public."School"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: SMSDeliveryLog SMSDeliveryLog_studentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SMSDeliveryLog"
    ADD CONSTRAINT "SMSDeliveryLog_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES public."Student"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ScheduledWork ScheduledWork_classId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ScheduledWork"
    ADD CONSTRAINT "ScheduledWork_classId_fkey" FOREIGN KEY ("classId") REFERENCES public."Class"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ScheduledWork ScheduledWork_contentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ScheduledWork"
    ADD CONSTRAINT "ScheduledWork_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES public."CurriculumContent"("contentId") ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: SchoolEvent SchoolEvent_schoolId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SchoolEvent"
    ADD CONSTRAINT "SchoolEvent_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES public."School"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: SchoolOnboarding SchoolOnboarding_schoolId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SchoolOnboarding"
    ADD CONSTRAINT "SchoolOnboarding_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES public."School"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: SchoolStorageQuota SchoolStorageQuota_schoolId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SchoolStorageQuota"
    ADD CONSTRAINT "SchoolStorageQuota_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES public."School"(id) ON DELETE CASCADE;


--
-- Name: School School_designatedSafetyStaffUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."School"
    ADD CONSTRAINT "School_designatedSafetyStaffUserId_fkey" FOREIGN KEY ("designatedSafetyStaffUserId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: School School_districtId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."School"
    ADD CONSTRAINT "School_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES public."District"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Session Session_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Session"
    ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: SloEvent SloEvent_schoolId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SloEvent"
    ADD CONSTRAINT "SloEvent_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES public."School"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: SmsResponse SmsResponse_sessionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SmsResponse"
    ADD CONSTRAINT "SmsResponse_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES public."SmsSession"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: SmsSession SmsSession_assignmentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SmsSession"
    ADD CONSTRAINT "SmsSession_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES public."Assignment"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: SmsSession SmsSession_studentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SmsSession"
    ADD CONSTRAINT "SmsSession_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: StagedRolloutPlan StagedRolloutPlan_changeRequestId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."StagedRolloutPlan"
    ADD CONSTRAINT "StagedRolloutPlan_changeRequestId_fkey" FOREIGN KEY ("changeRequestId") REFERENCES public."OptimizationChangeRequest"(id);


--
-- Name: StuckEvent StuckEvent_studentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."StuckEvent"
    ADD CONSTRAINT "StuckEvent_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES public."Student"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: StudentAdaptiveAttempt StudentAdaptiveAttempt_studentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."StudentAdaptiveAttempt"
    ADD CONSTRAINT "StudentAdaptiveAttempt_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES public."Student"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: StudentBadgeAward StudentBadgeAward_schoolId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."StudentBadgeAward"
    ADD CONSTRAINT "StudentBadgeAward_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES public."School"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: StudentBadgeAward StudentBadgeAward_studentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."StudentBadgeAward"
    ADD CONSTRAINT "StudentBadgeAward_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES public."Student"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: StudentGuardian StudentGuardian_guardianId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."StudentGuardian"
    ADD CONSTRAINT "StudentGuardian_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: StudentGuardian StudentGuardian_studentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."StudentGuardian"
    ADD CONSTRAINT "StudentGuardian_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES public."Student"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: StudentImportBatch StudentImportBatch_schoolId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."StudentImportBatch"
    ADD CONSTRAINT "StudentImportBatch_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES public."School"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: StudentMasteryProfile StudentMasteryProfile_studentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."StudentMasteryProfile"
    ADD CONSTRAINT "StudentMasteryProfile_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES public."Student"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: StudentMasteryProfile StudentMasteryProfile_subject_strandKey_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."StudentMasteryProfile"
    ADD CONSTRAINT "StudentMasteryProfile_subject_strandKey_fkey" FOREIGN KEY (subject, "strandKey") REFERENCES public."StrandCatalog"(subject, "strandKey") ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: StudentPerformanceEvent StudentPerformanceEvent_studentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."StudentPerformanceEvent"
    ADD CONSTRAINT "StudentPerformanceEvent_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES public."Student"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: StudentProgress StudentProgress_scheduledWorkId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."StudentProgress"
    ADD CONSTRAINT "StudentProgress_scheduledWorkId_fkey" FOREIGN KEY ("scheduledWorkId") REFERENCES public."ScheduledWork"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: StudentProgress StudentProgress_studentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."StudentProgress"
    ADD CONSTRAINT "StudentProgress_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: StudentSession StudentSession_studentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."StudentSession"
    ADD CONSTRAINT "StudentSession_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES public."Student"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: StudentStreak StudentStreak_studentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."StudentStreak"
    ADD CONSTRAINT "StudentStreak_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Student Student_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Student"
    ADD CONSTRAINT "Student_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Submission Submission_assessmentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Submission"
    ADD CONSTRAINT "Submission_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES public."Assessment"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Submission Submission_studentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Submission"
    ADD CONSTRAINT "Submission_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES public."Student"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: TeacherAlertPreference TeacherAlertPreference_teacherId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TeacherAlertPreference"
    ADD CONSTRAINT "TeacherAlertPreference_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: TeacherAssignment TeacherAssignment_classId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TeacherAssignment"
    ADD CONSTRAINT "TeacherAssignment_classId_fkey" FOREIGN KEY ("classId") REFERENCES public."Class"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: TeacherAssignment TeacherAssignment_schoolId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TeacherAssignment"
    ADD CONSTRAINT "TeacherAssignment_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES public."School"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: TeacherAssignment TeacherAssignment_teacherId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TeacherAssignment"
    ADD CONSTRAINT "TeacherAssignment_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: TeacherLessonAssignment TeacherLessonAssignment_assignedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TeacherLessonAssignment"
    ADD CONSTRAINT "TeacherLessonAssignment_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES public."User"(id) ON DELETE CASCADE;


--
-- Name: TeacherLessonAssignment TeacherLessonAssignment_classId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TeacherLessonAssignment"
    ADD CONSTRAINT "TeacherLessonAssignment_classId_fkey" FOREIGN KEY ("classId") REFERENCES public."Class"(id) ON DELETE CASCADE;


--
-- Name: TeacherLessonAssignment TeacherLessonAssignment_contentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TeacherLessonAssignment"
    ADD CONSTRAINT "TeacherLessonAssignment_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES public."CurriculumContent"("contentId") ON DELETE CASCADE;


--
-- Name: TeacherProfile TeacherProfile_schoolId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TeacherProfile"
    ADD CONSTRAINT "TeacherProfile_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES public."School"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: TeacherProfile TeacherProfile_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TeacherProfile"
    ADD CONSTRAINT "TeacherProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: TeacherSentiment TeacherSentiment_teacherId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TeacherSentiment"
    ADD CONSTRAINT "TeacherSentiment_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: TeachingLedger TeachingLedger_sessionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TeachingLedger"
    ADD CONSTRAINT "TeachingLedger_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES public."TeachingSession"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: TeachingTurn TeachingTurn_sessionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TeachingTurn"
    ADD CONSTRAINT "TeachingTurn_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES public."TeachingSession"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Term Term_academicYearId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Term"
    ADD CONSTRAINT "Term_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES public."AcademicYear"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: TextbookGenerationJob TextbookGenerationJob_requestedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TextbookGenerationJob"
    ADD CONSTRAINT "TextbookGenerationJob_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: TimetableAssignment TimetableAssignment_assignedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TimetableAssignment"
    ADD CONSTRAINT "TimetableAssignment_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: TimetableAssignment TimetableAssignment_curriculumContentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TimetableAssignment"
    ADD CONSTRAINT "TimetableAssignment_curriculumContentId_fkey" FOREIGN KEY ("curriculumContentId") REFERENCES public."CurriculumContent"("contentId") ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: TimetableAssignment TimetableAssignment_timetableId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TimetableAssignment"
    ADD CONSTRAINT "TimetableAssignment_timetableId_fkey" FOREIGN KEY ("timetableId") REFERENCES public."Timetable"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Timetable Timetable_classId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Timetable"
    ADD CONSTRAINT "Timetable_classId_fkey" FOREIGN KEY ("classId") REFERENCES public."Class"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Timetable Timetable_schoolId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Timetable"
    ADD CONSTRAINT "Timetable_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES public."School"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Timetable Timetable_teacherId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Timetable"
    ADD CONSTRAINT "Timetable_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: TrainingProgress TrainingProgress_moduleId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TrainingProgress"
    ADD CONSTRAINT "TrainingProgress_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES public."TrainingModule"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: TrainingProgress TrainingProgress_teacherUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TrainingProgress"
    ADD CONSTRAINT "TrainingProgress_teacherUserId_fkey" FOREIGN KEY ("teacherUserId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Transcript Transcript_academicYearId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Transcript"
    ADD CONSTRAINT "Transcript_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES public."AcademicYear"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Transcript Transcript_schoolId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Transcript"
    ADD CONSTRAINT "Transcript_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES public."School"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Transcript Transcript_studentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Transcript"
    ADD CONSTRAINT "Transcript_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES public."Student"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: TutorConversation TutorConversation_contentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TutorConversation"
    ADD CONSTRAINT "TutorConversation_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES public."CurriculumContent"("contentId") ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: TutorConversation TutorConversation_studentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TutorConversation"
    ADD CONSTRAINT "TutorConversation_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Unit Unit_standardId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Unit"
    ADD CONSTRAINT "Unit_standardId_fkey" FOREIGN KEY ("standardId") REFERENCES public."Standard"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: User User_schoolId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES public."School"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: VideoWatchEvent VideoWatchEvent_studentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."VideoWatchEvent"
    ADD CONSTRAINT "VideoWatchEvent_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES public."User"(id) ON DELETE CASCADE;


--
-- Name: VideoWatchEvent VideoWatchEvent_videoId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."VideoWatchEvent"
    ADD CONSTRAINT "VideoWatchEvent_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES public."LessonVideo"(id) ON DELETE CASCADE;


--
-- Name: _SkillToStandard _SkillToStandard_A_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."_SkillToStandard"
    ADD CONSTRAINT "_SkillToStandard_A_fkey" FOREIGN KEY ("A") REFERENCES public."Skill"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: _SkillToStandard _SkillToStandard_B_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."_SkillToStandard"
    ADD CONSTRAINT "_SkillToStandard_B_fkey" FOREIGN KEY ("B") REFERENCES public."Standard"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict E4guNUJRdVRgi5cZTi2qvp0km5ws9E12Tn9Q3Sdhgk6gfXaAeE1arAqMtEEmA9m
