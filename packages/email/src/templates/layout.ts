interface EmailLayout {
  readonly subject: string
  readonly body: string
  readonly action: string
  readonly actionUrl: string
  readonly notice: string
  readonly environmentLabel?: string
  readonly environmentNotice?: string
  readonly deliveryTest: boolean
}

const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ]!,
  )

// Resolved Flowmark colors: dashboard light primary/background/foreground and
// the shared FlowmarkWordmark's dark lockup + accent dot. Email is a separate
// rendering boundary: table layouts and inline CSS survive mail-client CSS
// stripping; importing React/shadcn/Tailwind web components would not.
const brand = {
  background: "#f7f8f7",
  foreground: "#111618",
  primary: "#336024",
  accent: "#bbf599",
  lockup: "#0d1311",
  border: "#dbe1de",
  muted: "#58655f",
  notice: "#f1f5ef",
} as const

export const renderEmailLayout = (content: EmailLayout) => {
  const subject = escapeHtml(content.subject)
  const url = escapeHtml(content.actionUrl)
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background-color:${brand.background};color:${brand.foreground};font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%;">
  <div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;overflow:hidden;opacity:0;mso-hide:all;">${escapeHtml(content.body)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${brand.background}" style="width:100%;border-collapse:collapse;">
    <tr>
      <td align="center" style="padding:32px 12px;">
        <!--[if mso]><table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="width:100%;max-width:560px;border:1px solid ${brand.border};border-radius:14px;border-spacing:0;">
          <tr>
            <td bgcolor="${brand.lockup}" style="padding:26px 28px;border-radius:13px 13px 0 0;border-bottom:3px solid ${brand.accent};">
              <span aria-label="Flowmark" style="color:#edf2ef;font-size:27px;line-height:32px;font-weight:700;letter-spacing:-1px;">flowmark<span style="color:${brand.accent};">.</span></span>
            </td>
          </tr>
          <tr>
            <td style="padding:30px 28px 28px;">
              <main>
                <p style="margin:0 0 12px;color:${brand.primary};font-size:11px;line-height:18px;font-weight:700;letter-spacing:1.6px;">${content.environmentLabel ? `${escapeHtml(content.environmentLabel.toUpperCase())} &middot; ` : ""}${content.deliveryTest ? "DELIVERY CHECK" : "ACCOUNT SECURITY"}</p>
                ${content.environmentNotice ? `<p style="margin:0 0 22px;border-left:3px solid ${brand.primary};background-color:${brand.notice};padding:12px 14px;color:${brand.primary};font-size:13px;line-height:21px;">${escapeHtml(content.environmentNotice)}</p>` : ""}
                <h1 style="margin:0 0 18px;color:${brand.foreground};font-size:28px;line-height:36px;font-weight:700;letter-spacing:-0.7px;">${subject}</h1>
                <p style="margin:0 0 26px;color:${brand.muted};font-size:16px;line-height:26px;">${escapeHtml(content.body)}</p>
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;">
                  <tr>
                    <td bgcolor="${brand.primary}" style="border-radius:8px;mso-padding-alt:14px 22px;">
                      <a href="${url}" style="display:inline-block;border:1px solid ${brand.primary};border-radius:8px;background-color:${brand.primary};padding:14px 22px;color:#ffffff;font-size:15px;line-height:22px;font-weight:700;text-align:center;text-decoration:none;">${escapeHtml(content.action)}</a>
                    </td>
                  </tr>
                </table>
                <p style="margin:26px 0 24px;border-left:3px solid ${brand.accent};background-color:${brand.notice};padding:14px 16px;color:${brand.muted};font-size:13px;line-height:21px;">${escapeHtml(content.notice)}</p>
                <p style="margin:0 0 8px;color:${brand.muted};font-size:12px;line-height:20px;">If the button does not work, copy and paste this link into your browser:</p>
                <p style="margin:0;word-break:break-all;word-wrap:break-word;font-size:12px;line-height:20px;"><a href="${url}" style="color:${brand.primary};text-decoration:underline;word-break:break-all;">${url}</a></p>
              </main>
            </td>
          </tr>
          <tr>
            <td style="border-top:1px solid ${brand.border};padding:20px 28px;color:${brand.muted};font-size:12px;line-height:20px;">
              Sent by Flowmark. Reply to this email if you need help.
            </td>
          </tr>
        </table>
        <!--[if mso]></td></tr></table><![endif]-->
        <p style="margin:20px 0 0;color:${brand.muted};font-size:11px;line-height:18px;">Flowmark &nbsp;&middot;&nbsp; Workflow observability</p>
      </td>
    </tr>
  </table>
</body>
</html>`
}
