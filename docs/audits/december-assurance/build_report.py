"""Renders DECEMBER_ASSURANCE_V1.md from december-assurance-v1.json.

The JSON is the source of truth; run `python3 build_report.py` after editing it.
"""
import json, pathlib

HERE = pathlib.Path(__file__).parent
data = json.loads((HERE / "december-assurance-v1.json").read_text())

lines = []
m = data["meta"]
lines += [f"# {m['title']}", "",
          f"- Base: `{m['base']}`",
          f"- Date: {m['date']}",
          f"- Scope: {m['scope']}",
          f"- External constraints: {m['external_constraints']}", ""]
c = data["summary"]["counts"]
lines += ["## Summary", "",
          "| Severity | Total | Fixed in this change | Documented (decision or external) |",
          "| --- | --- | --- | --- |"]
for sev in ["P0", "P1", "P2", "P3"]:
    lines.append(f"| {sev} | {c[sev]['total']} | {c[sev]['fixed']} | {c[sev]['documented']} |")
lines += ["", data["summary"]["verdict"], ""]

lines += ["## Findings", ""]
for f in data["findings"]:
    lines += [f"### {f['id']} · {f['severity']} · {f['title']}", "",
              f"- **Lens:** {f['lens']}",
              f"- **Affected role:** {f['role']}",
              f"- **Location:** {', '.join('`'+l+'`' for l in f['location'])}",
              f"- **Evidence / reproduction:** {f['evidence']}",
              f"- **Authority / privacy impact:** {f['impact']}",
              f"- **Fix status:** {f['fix_status']}" + (f" — {f['fix']}" if f.get('fix') else ""),
              f"- **Closure test:** {f['test'] or 'n/a'}",
              f"- **External dependency:** {f['external'] or 'none'}", ""]

lines += ["## Journey evidence (pass/fail)", "",
          "| Lens | Journey / check | Result | Evidence |", "| --- | --- | --- | --- |"]
for j in data["journeys"]:
    lines.append(f"| {j['lens']} | {j['check']} | {j['result']} | {j['evidence']} |")
lines += ["", "## External-only readiness items", ""]
lines += [f"- {x}" for x in data["external_only"]]
lines += ["", "## Recommended next December mission", "", data["next_mission"], ""]
(HERE / "DECEMBER_ASSURANCE_V1.md").write_text("\n".join(lines))
print("wrote", HERE / "DECEMBER_ASSURANCE_V1.md")
