// /api/sign.js
// Vercel serverless function — receives signed contract data and PDF,
// emails the PDF to Digital Craft (you) and to the signer.

import { Resend } from 'resend';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const FROM_EMAIL = process.env.FROM_EMAIL || 'contracts@thedigicraft.co.uk';
  const NOTIFY_EMAIL = process.env.NOTIFY_EMAIL || 'hello@thedigicraft.co.uk';

  if (!RESEND_API_KEY) {
    console.error('Missing RESEND_API_KEY env var');
    return res.status(500).json({ error: 'Server is not configured. Please contact Digital Craft directly.' });
  }

  const resend = new Resend(RESEND_API_KEY);

  try {
    const {
      'signer-name': signerName,
      'signer-company': signerCompany,
      'signer-role': signerRole,
      'signer-email': signerEmail,
      'signer-address': signerAddress,
      'signer-date': signerDate,
      timestamp,
      userAgent,
      pdfFilename,
      pdfBase64
    } = req.body || {};

    // Basic validation
    if (!signerName || !signerEmail || !pdfBase64 || !pdfFilename) {
      return res.status(400).json({ error: 'Missing required fields.' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(signerEmail)) {
      return res.status(400).json({ error: 'Invalid email address.' });
    }

    // Capture client IP for audit
    const clientIp =
      req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      req.headers['x-real-ip'] ||
      'unknown';

    const subject = `Signed subscription agreement · ${signerName} (GamLEARN)`;

    const auditHtml = `
      <p style="margin:0 0 8px"><strong>Signer:</strong> ${escapeHtml(signerName)}</p>
      <p style="margin:0 0 8px"><strong>Organisation:</strong> ${escapeHtml(signerCompany)}</p>
      <p style="margin:0 0 8px"><strong>Role:</strong> ${escapeHtml(signerRole || '—')}</p>
      <p style="margin:0 0 8px"><strong>Email:</strong> ${escapeHtml(signerEmail)}</p>
      <p style="margin:0 0 8px"><strong>Address:</strong> ${escapeHtml(signerAddress)}</p>
      <p style="margin:0 0 8px"><strong>Date:</strong> ${escapeHtml(signerDate)}</p>
      <p style="margin:0 0 8px"><strong>Timestamp (UTC):</strong> ${escapeHtml(timestamp)}</p>
      <p style="margin:0 0 8px"><strong>IP address:</strong> ${escapeHtml(clientIp)}</p>
      <p style="margin:0 0 8px"><strong>User agent:</strong> ${escapeHtml((userAgent || '').substring(0, 200))}</p>
    `;

    // Email to Digital Craft (you) — full audit trail
    const internalBody = renderEmail({
      heading: 'New signed subscription agreement',
      lede: `${signerName} of ${signerCompany} has signed and submitted the website &amp; CRM service and subscription agreement.`,
      blockTitle: 'Signature record',
      blockHtml: auditHtml,
      footnote: 'Signed PDF attached.'
    });

    // Email to signer — friendly confirmation
    const clientBody = renderEmail({
      heading: 'Your signed agreement',
      lede: `Hi ${escapeHtml(signerName.split(' ')[0])}, thank you for signing the website &amp; CRM subscription agreement with Digital Craft. A copy is attached for your records.`,
      blockTitle: 'What happens next',
      blockHtml: `
        <p style="margin:0 0 12px">Your subscription is now set up at £249 per month, covering hosting, support, bug fixes and minor tweaks for your website and CRM. We'll keep both systems running and looked after, and we're on hand whenever you need us.</p>
        <p style="margin:0">If anything in the attached document doesn't look right, just reply to this email and we'll get it sorted.</p>
      `,
      footnote: 'Digital Craft · thedigicraft.co.uk'
    });

    const attachments = [{ filename: pdfFilename, content: pdfBase64 }];

    // Send both emails in parallel
    const [internalResult, clientResult] = await Promise.allSettled([
      resend.emails.send({
        from: FROM_EMAIL,
        to: [NOTIFY_EMAIL],
        replyTo: signerEmail,
        subject,
        html: internalBody,
        attachments
      }),
      resend.emails.send({
        from: FROM_EMAIL,
        to: [signerEmail],
        replyTo: NOTIFY_EMAIL,
        subject: `Your signed agreement · Digital Craft × GamLEARN`,
        html: clientBody,
        attachments
      })
    ]);

    // The SDK resolves with { data, error } rather than rejecting on API errors
    const internalError =
      internalResult.status === 'rejected' ? internalResult.reason : internalResult.value?.error;
    const clientError =
      clientResult.status === 'rejected' ? clientResult.reason : clientResult.value?.error;

    // If the internal one failed, that's a hard fail (you need to know)
    if (internalError) {
      console.error('Internal email failed:', internalError);
      return res.status(500).json({ error: 'Could not record the signature. Please try again or contact Digital Craft.' });
    }

    // If only the client copy failed, log but still return success
    if (clientError) {
      console.warn('Client copy failed:', clientError);
    }

    return res.status(200).json({
      ok: true,
      timestamp
    });
  } catch (err) {
    console.error('Handler error:', err);
    return res.status(500).json({ error: 'Unexpected server error. Please try again.' });
  }
}

// ---- Helpers ----

function renderEmail({ heading, lede, blockTitle, blockHtml, footnote }) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8" /></head>
<body style="margin:0;padding:0;background:#FAFBFC;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#FAFBFC;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellspacing="0" cellpadding="0" style="background:#FFFFFF;border:1px solid #E5E8EE;border-radius:8px;overflow:hidden;">
          <tr>
            <td style="height:4px;background:linear-gradient(90deg,#38005F,#4B0082,#00664D);"></td>
          </tr>
          <tr>
            <td style="padding:32px 40px 8px;">
              <p style="margin:0 0 16px;font-size:11px;font-weight:600;letter-spacing:0.16em;color:#4B0082;text-transform:uppercase;">Digital Craft × GamLEARN</p>
              <h1 style="margin:0 0 12px;font-family:Georgia,serif;font-weight:500;font-size:24px;line-height:1.25;color:#1A1A1A;letter-spacing:-0.015em;">${heading}</h1>
              <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#2B3548;">${lede}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 40px 32px;">
              <div style="background:#FAFBFC;border:1px solid #E5E8EE;border-radius:6px;padding:20px;">
                <p style="margin:0 0 12px;font-size:11px;font-weight:600;letter-spacing:0.12em;color:#5A6670;text-transform:uppercase;">${blockTitle}</p>
                <div style="font-size:14px;line-height:1.6;color:#2B3548;">${blockHtml}</div>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:0 40px 32px;border-top:1px solid #E5E8EE;">
              <p style="margin:24px 0 0;font-size:12px;color:#5A6670;line-height:1.5;">${footnote}</p>
            </td>
          </tr>
        </table>
        <p style="margin:24px 0 0;font-size:11px;color:#5A6670;">thedigicraft.co.uk</p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Increase body size limit for the base64 PDF
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '4mb'
    }
  }
};
