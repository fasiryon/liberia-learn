import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import LabChatPanel from "@/components/labs/LabChatPanel";
import LabShell from "@/components/labs/LabShell";

describe("LabShell and LabChatPanel", () => {
  it("LabShell renders children when WebGL is available", () => {
    const html = renderToStaticMarkup(
      <LabShell
        labId="gravity-explorer"
        initialState={{ paused: true }}
        webglAvailableOverride={true}
        onAction={() => ({ paused: false })}
      >
        <div>Scene is ready</div>
      </LabShell>
    );

    expect(html).toContain("Scene is ready");
    expect(html).toContain("State");
  });

  it("LabShell renders LabFallback when WebGL is unavailable", () => {
    const html = renderToStaticMarkup(
      <LabShell
        labId="gravity-explorer"
        initialState={{ paused: true }}
        webglAvailableOverride={false}
        onAction={() => ({ paused: false })}
      >
        <div>Scene is ready</div>
      </LabShell>
    );

    expect(html).toContain("2D fallback");
    expect(html).toContain("WebGL unavailable");
  });

  it("LabChatPanel renders suggested prompts", () => {
    const html = renderToStaticMarkup(
      <LabChatPanel
        labId="gravity-explorer"
        state={{ paused: true }}
        suggestedPrompts={["What if gravity was stronger?", "Start the lab"]}
        onAction={() => ({ paused: false })}
      />
    );

    expect(html).toContain("What if gravity was stronger?");
    expect(html).toContain("Start the lab");
  });
});
