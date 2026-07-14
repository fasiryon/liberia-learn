# Orange Liberia Inbound SMS - Confirmation Action Item

STATUS: **Action item for the human.** This cannot be resolved by continued
code research - it needs a real answer from Orange, which requires either
an existing business contact or submitting Orange's own contact form
(which requires signing in to an Orange developer account).

## What's confirmed so far (2026-07-14)
Four official Orange developer pages for the SMS Liberia / SMS Africa &
Middle East (2.0) product - overview, getting-started, API reference, FAQ -
document only:
- Sending SMS (`POST .../smsmessaging/v1/outbound/...`)
- Delivery-status callbacks (`deliveryInfoNotification` - reports whether a
  message YOU sent was delivered, not a message a guardian sent TO you)
- Admin/contract/balance/usage endpoints

**No mobile-originated (MO) / inbound-SMS endpoint or webhook format is
documented anywhere in those four pages.** A single web-search snippet
suggested Orange's broader product family supports "SMS MO," but that
capability could not be found documented for this specific product after
checking four separate official pages plus the pricing page. This is not
proof it doesn't exist - Orange may offer inbound SMS/shortcode reception
as a separate product, a manually-provisioned add-on, or something only
visible after logging into a developer account - but it is not part of the
publicly documented self-serve API.

## Do you already have an Orange Liberia business/developer contact?
I can't determine this from the codebase - there's no record of an
existing Orange relationship, developer account, or prior correspondence
anywhere in this repo. **If LiberiaLearn already has a business or
technical contact at Orange Liberia (sales rep, account manager, technical
integration contact), that is almost certainly the fastest path** - a
direct, specific question gets a real answer faster than a cold contact-form
submission into a general support queue.

**If no such contact exists yet**, the path is:
1. Create/sign in to an Orange Developer account at
   https://developer.orange.com (required - their contact form is
   gated behind "Signin to access contact form").
2. Navigate to the SMS Liberia product's Contact Us page:
   https://developer.orange.com/apis/sms-liberia/contact-us (or the shared
   regional page: https://developer.orange.com/apis/sms/contact-us).
3. Submit a specific, narrow question - broad questions get generic
   answers. Suggested wording:

   > "Does the SMS Liberia (2.0) API support receiving inbound/mobile-
   > originated (MO) SMS from end users - i.e., can our platform receive a
   > webhook or callback when a customer replies to a message we sent, or
   > texts our sender number directly? If so, please point me to the
   > documentation for configuring the inbound webhook/callback and any
   > shortcode/keyword provisioning required. If not supported by this
   > product, is there a separate Orange Liberia product that does support
   > two-way SMS?"

## Why this is an action item for you, not me
Submitting Orange's contact form requires an authenticated developer
account tied to a real identity/organization (LiberiaLearn), and likely
becomes the basis of an actual business relationship or support ticket
history with Orange. That's not something to create or act on
autonomously on your behalf - it's exactly the kind of external,
organization-representing communication that needs your sign-off (or
should go through whoever already owns the Orange relationship, if anyone
does).

## What happens once you have an answer
- **If Orange confirms inbound support**: revisit
  `docs/agents/GUARDIAN_COST_ACCOUNTING.md`'s two-way/one-way split -
  `selectTwoWaySmsProvider()` in `lib/sms.ts` would need to be updated to
  allow Orange for two-way traffic, and an inbound webhook handler
  (`app/api/webhooks/sms-inbound`-equivalent for Orange's format) would need
  to be built, following the same `handleGuardianInbound()` pattern Twilio
  already uses.
- **If Orange confirms no inbound support (or a separate/costlier product
  is required)**: no code change needed - the current outbound-only wiring
  and the Twilio-only two-way guarantee already reflect that reality
  correctly. Worth closing the loop by updating this doc's STATUS line so a
  future session doesn't re-ask the same question.
