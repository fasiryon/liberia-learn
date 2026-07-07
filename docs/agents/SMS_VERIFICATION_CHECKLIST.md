# SMS Verification Checklist (real-number testing)

Sprint 6.0b ships a **dev SMS simulator** (`POST /api/dev/simulate-inbound-sms`,
blocked in production) so the agent SMS path can be exercised without a live
Africa's Talking Liberia number. The items below **cannot** be validated by the
simulator and MUST be verified against a real number before any SMS-facing agent
(6.1+) goes to pilot.

## Prerequisites
- A provisioned Africa's Talking Liberia shortcode / number.
- `AFRICASTALKING_*` credentials set in Vercel prod env.
- An SMS-facing agent registered and its `featureFlag` enabled (6.1+).

## Checklist

- [ ] **Inbound webhook fires.** Sending an SMS to the number hits the production
      inbound webhook and creates a log entry. Confirm the webhook URL is
      registered in the Africa's Talking dashboard.
- [ ] **Message parsing works.** `from` (MSISDN) and `text` are parsed and
      normalized identically to `parseInboundSms` (`lib/agents/sms/inbound.ts`).
      Verify a Liberian number (`+231…`) normalizes correctly.
- [ ] **Response delivery works.** The agent's reply is delivered back to the
      handset. Measure round-trip latency.
- [ ] **Multi-message conversation state persists.** A follow-up SMS from the same
      number continues the same conversation/goal (not a fresh session). Verify
      state is keyed on the normalized MSISDN.
- [ ] **Cost per message matches expected.** Compare Africa's Talking billed cost
      per inbound + outbound segment against the budgeted figure. Confirm long
      replies are segmented as expected and costed accordingly.
- [ ] **Opt-out / STOP honored.** Confirm existing SMS opt-out handling applies to
      agent messages.

## How the simulator maps to production
| Concern | Simulator covers? | Real-number only |
|---|---|---|
| Inbound parse/normalize | ✅ (`parseInboundSms`) | — |
| Webhook registration/firing | ❌ | ✅ |
| Outbound delivery | ❌ | ✅ |
| Conversation state across messages | partial (once agent wired) | ✅ delivery timing |
| Per-message billing | ❌ | ✅ |

Record results (date, tester, number, latency, cost) below when run.
