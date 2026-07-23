import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export const runtime = 'nodejs';

const addressOnly = (value: string) => {
  const match = value.match(/<([^>]+)>/);
  return (match ? match[1] : value).trim().toLowerCase();
};

const escapeHtml = (value: string) => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

export async function GET() {
  const apiKey = String(process.env.RESEND_API_KEY || '').trim();
  return NextResponse.json({
    configured: Boolean(apiKey),
    keyFormatValid: apiKey.startsWith('re_') && apiKey.length > 10,
    defaultFromConfigured: Boolean(String(process.env.SCOPELOGIC_DEFAULT_FROM_EMAIL || '').trim()),
  });
}

export async function POST(request: Request) {
  try {
    const apiKey = String(process.env.RESEND_API_KEY || '').trim();
    if (!apiKey) {
      return NextResponse.json({ error: 'Email is not configured. Add a valid RESEND_API_KEY in Vercel Project Settings → Environment Variables, then redeploy.' }, { status: 503 });
    }
    if (!apiKey.startsWith('re_') || apiKey.length <= 10) {
      return NextResponse.json({ error: 'RESEND_API_KEY has an invalid format. Replace it with the complete secret key from the Resend dashboard, apply it to the active Vercel environment, and redeploy.' }, { status: 503 });
    }

    const body = await request.json();
    const to = Array.isArray(body.to) ? body.to.filter(Boolean) : [];
    const cc = Array.isArray(body.cc) ? body.cc.filter(Boolean) : [];
    const subject = String(body.subject || '').trim();
    const message = String(body.message || '').trim();
    const filename = String(body.filename || 'ScopeLogic_Deliverable.pdf').trim();
    const attachmentBase64 = String(body.attachmentBase64 || '');
    const configuredDefault = String(process.env.SCOPELOGIC_DEFAULT_FROM_EMAIL || '').trim();
    const requestedFrom = String(body.from || '').trim();
    const from = requestedFrom || configuredDefault;
    const replyTo = String(body.replyTo || process.env.SCOPELOGIC_DEFAULT_REPLY_TO || '').trim();

    if (!from) return NextResponse.json({ error: 'No sender is configured. Set a From address in the app or SCOPELOGIC_DEFAULT_FROM_EMAIL in Vercel.' }, { status: 400 });
    if (!to.length) return NextResponse.json({ error: 'At least one recipient is required.' }, { status: 400 });
    if (!subject) return NextResponse.json({ error: 'A subject is required.' }, { status: 400 });
    if (!attachmentBase64) return NextResponse.json({ error: 'The PDF attachment is missing.' }, { status: 400 });

    const environmentApproved = String(process.env.SCOPELOGIC_ALLOWED_FROM_EMAILS || '')
      .split(',')
      .map((item) => addressOnly(item))
      .filter(Boolean);
    const appApproved = Array.isArray(body.approvedFrom)
      ? body.approvedFrom.map((item: unknown) => addressOnly(String(item || ''))).filter(Boolean)
      : [];
    const approved = Array.from(new Set([addressOnly(configuredDefault), ...environmentApproved, ...appApproved].filter(Boolean)));
    if (requestedFrom && approved.length && !approved.includes(addressOnly(requestedFrom))) {
      return NextResponse.json({ error: 'The selected From address is not included in the approved sender list saved in the app.' }, { status: 400 });
    }

    const resend = new Resend(apiKey);
    const htmlMessage = escapeHtml(message).replace(/\n/g, '<br />');
    const logo = await readFile(join(process.cwd(), 'public', 'brand', 'scopelogic-wordmark.png')).catch(() => null);
    const { data, error } = await resend.emails.send({
      from,
      to,
      cc: cc.length ? cc : undefined,
      replyTo: replyTo || undefined,
      subject,
      text: message,
      html: `<div style="font-family:Arial,sans-serif;color:#172018;line-height:1.55">${logo ? '<img src="cid:scopelogic-wordmark" alt="ScopeLogic" style="display:block;width:220px;max-width:100%;height:auto;margin-bottom:20px" />' : '<div style="font-size:20px;font-weight:700;color:#35451d;margin-bottom:18px">ScopeLogic LLC</div>'}<div>${htmlMessage}</div><div style="margin-top:24px;padding-top:12px;border-top:1px solid #dce2da;font-size:12px;color:#697269">Identify. Clarify. Rectify.</div></div>`,
      attachments: [
        { filename, content: Buffer.from(attachmentBase64, 'base64') },
        ...(logo ? [{ filename: 'scopelogic-wordmark.png', content: logo, contentId: 'scopelogic-wordmark' }] : []),
      ],
    });

    if (error) {
      const providerMessage = error.message || 'The email provider rejected the message.';
      if (/api key is invalid|invalid api key|unauthorized/i.test(providerMessage)) {
        return NextResponse.json({ error: 'The Resend API key configured in Vercel is invalid. Replace RESEND_API_KEY with a current complete key from Resend, confirm it is assigned to Production/Preview as needed, and redeploy the project.' }, { status: 503 });
      }
      return NextResponse.json({ error: providerMessage }, { status: 500 });
    }
    return NextResponse.json({ id: data?.id });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unexpected email-service error.' }, { status: 500 });
  }
}
