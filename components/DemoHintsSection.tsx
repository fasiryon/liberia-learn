import { DemoHints } from "@/components/DemoHints";
import { shouldShowDemoCredentials } from "@/lib/demoCredentials";
import {
  getDemoHintGroup,
  getDemoHintGroups,
  type DemoHintGroup,
} from "@/lib/demoHints";

type DemoHintKey = DemoHintGroup["key"];

type DemoHintsSectionProps = {
  variant: "login" | DemoHintKey;
};

export function DemoHintsSection({ variant }: DemoHintsSectionProps) {
  if (!shouldShowDemoCredentials()) return null;

  const groups =
    variant === "login"
      ? getDemoHintGroups()
      : [getDemoHintGroup(variant)];

  return <DemoHints title="Demo Login Hints" groups={groups} />;
}
