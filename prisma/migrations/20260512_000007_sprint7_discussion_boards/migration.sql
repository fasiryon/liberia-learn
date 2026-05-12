-- Sprint 7: class discussion boards

CREATE TABLE "DiscussionThread" (
  "id" TEXT NOT NULL,
  "classId" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "contentId" TEXT,
  "title" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "authorRole" TEXT NOT NULL,
  "pinned" BOOLEAN NOT NULL DEFAULT false,
  "locked" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DiscussionThread_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DiscussionPost" (
  "id" TEXT NOT NULL,
  "threadId" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "authorRole" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "parentPostId" TEXT,
  "upvotes" INTEGER NOT NULL DEFAULT 0,
  "flagged" BOOLEAN NOT NULL DEFAULT false,
  "pending" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DiscussionPost_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DiscussionUpvote" (
  "id" TEXT NOT NULL,
  "postId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DiscussionUpvote_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DiscussionLastRead" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "threadId" TEXT NOT NULL,
  "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DiscussionLastRead_pkey" PRIMARY KEY ("id")
);

-- Foreign keys
ALTER TABLE "DiscussionThread" ADD CONSTRAINT "DiscussionThread_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DiscussionThread" ADD CONSTRAINT "DiscussionThread_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DiscussionPost" ADD CONSTRAINT "DiscussionPost_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "DiscussionThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DiscussionPost" ADD CONSTRAINT "DiscussionPost_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DiscussionPost" ADD CONSTRAINT "DiscussionPost_parentPostId_fkey" FOREIGN KEY ("parentPostId") REFERENCES "DiscussionPost"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DiscussionUpvote" ADD CONSTRAINT "DiscussionUpvote_postId_fkey" FOREIGN KEY ("postId") REFERENCES "DiscussionPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DiscussionUpvote" ADD CONSTRAINT "DiscussionUpvote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DiscussionLastRead" ADD CONSTRAINT "DiscussionLastRead_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DiscussionLastRead" ADD CONSTRAINT "DiscussionLastRead_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "DiscussionThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Unique constraints
CREATE UNIQUE INDEX "DiscussionUpvote_postId_userId_key" ON "DiscussionUpvote"("postId", "userId");
CREATE UNIQUE INDEX "DiscussionLastRead_userId_threadId_key" ON "DiscussionLastRead"("userId", "threadId");

-- Indexes
CREATE INDEX "DiscussionThread_classId_pinned_updatedAt_idx" ON "DiscussionThread"("classId", "pinned", "updatedAt");
CREATE INDEX "DiscussionThread_schoolId_classId_idx" ON "DiscussionThread"("schoolId", "classId");
CREATE INDEX "DiscussionThread_classId_contentId_idx" ON "DiscussionThread"("classId", "contentId");
CREATE INDEX "DiscussionPost_threadId_createdAt_idx" ON "DiscussionPost"("threadId", "createdAt");
CREATE INDEX "DiscussionPost_threadId_pending_idx" ON "DiscussionPost"("threadId", "pending");
CREATE INDEX "DiscussionUpvote_postId_idx" ON "DiscussionUpvote"("postId");
CREATE INDEX "DiscussionLastRead_userId_idx" ON "DiscussionLastRead"("userId");
