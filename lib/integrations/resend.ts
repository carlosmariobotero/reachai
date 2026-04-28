import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY!);

export interface OutreachEmailParams {
  to: string;
  firstName: string;
  videoUrl: string;
  senderName: string;
  senderEmail: string;
  customMessage?: string;
}

export async function sendOutreachEmail(params: OutreachEmailParams) {
  const { to, firstName, videoUrl, senderName, senderEmail, customMessage } =
    params;

  return resend.emails.send({
    from: senderEmail,
    to,
    subject: `${firstName}, I made this for you`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <p>Hi ${firstName},</p>
        ${customMessage ? `<p>${customMessage}</p>` : ""}
        <p>I recorded a quick personalized video for you:</p>
        <p>
          <a href="${videoUrl}" style="background: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            Watch your video →
          </a>
        </p>
        <p>Looking forward to connecting,<br/>${senderName}</p>
      </div>
    `,
  });
}

export { resend };
