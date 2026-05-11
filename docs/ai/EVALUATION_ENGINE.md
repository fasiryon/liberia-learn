# Evaluation Engine

## Outcome Attribution

Every recommendation or action must capture baseline state, decision evidence, action state, and outcome window. Attribution must distinguish correlation from causation and avoid presenting unproven claims as impact.

## Intervention Effectiveness

Use existing intervention chains, mastery snapshots, assessment attempts, scheduled work, and progress records to measure whether an intervention improved learning outcomes. Do not create fake intervention success metrics.

## False-Positive Tracking

Track recommendations that were unnecessary, rejected, or followed by no measurable risk. Use this to lower confidence or adjust triggers.

## False-Negative Tracking

Track missed cases where risk emerged without detection. Use teacher/admin feedback, mastery drops, missed work, and assessment decline signals.

## Confidence Calibration

Confidence must be recalibrated using observed outcomes. Store calibration version references so historical recommendations remain explainable.

## Optimization Feedback Loops

Evaluation output may feed:

- agent trigger thresholds
- intervention recommendations
- curriculum improvement proposals
- teacher workflow suggestions
- national aggregate trend analysis

Optimization must remain proposal-based until governance approves broader autonomy.
