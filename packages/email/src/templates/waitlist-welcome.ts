import type { EmailEnvironment } from "../config.js"
import { emailEnvironmentLabel } from "../config.js"
import type { RenderedEmail } from "../message.js"

/** Fixed copy and URL only: no recipient or untrusted values enter HTML. */
export const renderWaitlistWelcome = (
  message: { readonly to: string; readonly messageId: string },
  environment: EmailEnvironment,
): RenderedEmail => {
  const label = emailEnvironmentLabel(environment)
  const subject = `${environment === "production" ? "" : `[${label}] `}You’re on the Flowmark waitlist`
  const notice = environment === "production" ? "" : `${label.toUpperCase()} · `
  return {
    to: message.to,
    subject,
    idempotencyKey: `flowmark/${environment}/waitlist-welcome/${message.messageId}`,
    text: `${subject}\n\nYou’re on the list.\n\nThanks for joining the Flowmark waitlist. We’ll email you when access opens.\n\nUnderstand what your software actually does.\nDiscover processes. Connect execution to business outcomes. Investigate with shared evidence for people and agents.\n\nExplore Flowmark: https://flowmark.dev/\n\nQuestions or ideas? Reply to this email. We’d love to hear what you’re building.\n\nYou received this because this address was added to the Flowmark waitlist. If this wasn’t you, you can ignore this email.\n\nFlowmark — Process intelligence for people and agents.`,
    html: `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="dark"><title>${subject}</title></head>
<body style="margin:0;padding:0;background:#090f0c;color:#edf2ef;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">Your place is saved. We’ll email you when Flowmark access opens.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#090f0c"><tr><td align="center" style="padding:40px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#101713" style="max-width:580px;border:1px solid #29332c;border-radius:16px;border-spacing:0;">
<tr><td style="padding:30px 28px;border-bottom:1px solid #29332c;"><span style="font-size:28px;font-weight:700;letter-spacing:-1px;color:#edf2ef;">flowmark<span style="color:#b9f597;">.</span></span></td></tr>
<tr><td style="padding:38px 28px 32px;">
<p style="margin:0 0 20px;font-size:11px;line-height:18px;letter-spacing:2px;color:#b7a3ff;">${notice}WAITLIST CONFIRMED</p>
<h1 style="margin:0 0 22px;font-size:42px;line-height:46px;letter-spacing:-1.6px;font-weight:600;color:#b9f597;">You’re on the list.</h1>
<p style="margin:0 0 32px;font-size:16px;line-height:27px;color:#b9c5bd;">Thanks for joining the Flowmark waitlist.<br>We’ll email you when access opens.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding:24px 0;border-top:1px solid #29332c;border-bottom:1px solid #29332c;">
<h2 style="margin:0 0 14px;font-size:25px;line-height:32px;letter-spacing:-.6px;font-weight:500;color:#edf2ef;">Understand what your<br>software actually does.</h2>
<p style="margin:0;font-size:14px;line-height:25px;color:#a6b4aa;">Discover processes. Connect execution to business outcomes. Investigate with shared evidence for people and agents.</p>
</td></tr></table>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:30px;"><tr><td bgcolor="#b9f597" style="border-radius:8px;mso-padding-alt:15px 23px;"><a href="https://flowmark.dev/" style="display:inline-block;padding:15px 23px;border:1px solid #b9f597;border-radius:8px;background:#b9f597;color:#13200e;font-size:14px;line-height:20px;font-weight:700;text-decoration:none;">Explore Flowmark &rarr;</a></td></tr></table>
<p style="margin:30px 0 0;font-size:14px;line-height:25px;color:#a6b4aa;">Questions or ideas? Reply to this email.<br>We’d love to hear what you’re building.</p>
</td></tr>
<tr><td style="padding:24px 28px;border-top:1px solid #29332c;font-size:11px;line-height:19px;color:#92a197;">You received this because this address was added to the Flowmark waitlist. If this wasn’t you, you can ignore this email.</td></tr>
</table>
<p style="margin:22px 0 0;font-size:11px;line-height:20px;color:#92a197;">Flowmark &middot; Process intelligence for people and agents.</p>
</td></tr></table></body></html>`,
  }
}
