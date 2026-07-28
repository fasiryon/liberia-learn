-- TeachingSession is new in this unshipped sprint. Reserve turn indexes with
-- an atomic increment so concurrent submissions cannot collide on the
-- TeachingTurn(sessionId, turnIndex) unique constraint.
ALTER TABLE "TeachingSession"
ADD COLUMN "nextTurnIndex" INTEGER NOT NULL DEFAULT 0;
