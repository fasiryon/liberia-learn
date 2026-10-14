import type { ReactNode, Ref } from "react";
import { Lightbulb, PencilLine } from "lucide-react";

/**
 * A teaching scene: one learning move with a clear headline, an optional primary visual beside the
 * teaching text (side by side when the stage is wide enough, stacked otherwise), concise teaching
 * points, a worked example and the learner's task. Each part renders only when the lesson supplies it;
 * there are no decorative placeholders standing in for content.
 */
export function TeachingScene({ kind, title, titleId, titleRef, headingLevel = 2, lead, visual, children, className = "" }: {
  kind: ReactNode;
  title: ReactNode;
  titleId: string;
  titleRef?: Ref<HTMLHeadingElement>;
  headingLevel?: 1 | 2;
  lead?: ReactNode;
  visual?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  const Heading = headingLevel === 1 ? "h1" : "h2";
  return <section className={`ll3-scene ${className}`.trim()} data-has-visual={visual ? "" : undefined} aria-labelledby={titleId}>
    <div>
      <p className="ll3-scene-kind">{kind}</p>
      <Heading id={titleId} ref={titleRef} tabIndex={-1} className="ll3-scene-title">{title}</Heading>
    </div>
    <div className="ll3-scene-body">
      <div className="ll3-scene-text">
        {lead && <div className="ll3-scene-lead">{lead}</div>}
        {children}
      </div>
      {visual && <div className="ll3-scene-visual">{visual}</div>}
    </div>
  </section>;
}

export function TeachingPoints({ items, label }: { items: readonly ReactNode[]; label?: string }) {
  if (items.length === 0) return null;
  return <ol className="ll3-points" aria-label={label ?? "Key points"}>{items.map((item, index) => <li key={index}>{item}</li>)}</ol>;
}

export function WorkedExample({ label = "Worked example", steps, children }: { label?: ReactNode; steps?: readonly ReactNode[]; children?: ReactNode }) {
  return <div className="ll3-example">
    <p className="ll3-example-label"><Lightbulb size={18} aria-hidden="true" /> {label}</p>
    {children}
    {steps && steps.length > 0 && <ol className="ll3-steps">{steps.map((step, index) => <li key={index}><span>{step}</span></li>)}</ol>}
  </div>;
}

export function LearnerTask({ label = "Your turn", children }: { label?: ReactNode; children: ReactNode }) {
  return <div className="ll3-task">
    <p className="ll3-task-label"><PencilLine size={16} aria-hidden="true" className="mr-1 inline" />{label}</p>
    {children}
  </div>;
}

export function Figure({ caption, children }: { caption?: ReactNode; children: ReactNode }) {
  return <figure className="ll3-figure">{children}{caption && <figcaption>{caption}</figcaption>}</figure>;
}
