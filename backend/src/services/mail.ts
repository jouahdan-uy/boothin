
import type { Config } from "../config.js";
import {
  escapeHtml,
  singleLine,
  type OwnerMessage,
} from "../lib/message.js";

export class MailNotConfiguredError extends Error {
  constructor() {
    super("Resend API key belum dikonfigurasi.");
    this.name = "MailNotConfiguredError";
  }
}

export class OwnerNotConfiguredError extends Error {
  constructor() {
    super("OWNER_EMAIL belum dikonfigurasi.");
    this.name = "OwnerNotConfiguredError";
  }
}

export interface PhotoMail {
  to: string;
  link: string;
  photo: Uint8Array;
  filename: string;
}

/**
 * Mengirim email melalui Resend.
 * Jika gagal, detail error provider dimasukkan ke pesan error server.
 */
async function sendResendEmail(
  config: Config,
  payload: Record<string, unknown>,
): Promise<void> {
  if (!config.resendApiKey) {
    throw new MailNotConfiguredError();
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const detail = await response.text();

    throw new Error(
      `Resend menolak email (${response.status}): ${detail}`,
    );
  }
}

function buildHtml(link: string): string {
  const safeLink = escapeHtml(link);

  return `<!doctype html>
<html>
  <body style="margin:0;padding:32px;background:#eee7dc;font-family:Georgia,serif;color:#171515">
    <div style="max-width:480px;margin:0 auto;background:#fffdf8;padding:32px;border:1px solid #171515">
      <p style="font-size:28px;font-style:italic;margin:0 0 16px">boothin'</p>
      <h1 style="font-size:22px;margin:0 0 12px">Your Boothin' moment is here 📸</h1>
      <p style="line-height:1.6;margin:0 0 20px">
        Here's your photo from boothin' by zzuhdamn. It's attached to this email.
      </p>
      <p style="line-height:1.6;margin:0 0 20px;font-size:14px">
        You can also open it here until the link expires:<br />
        <a href="${safeLink}" style="color:#171515">${safeLink}</a>
      </p>
      <p style="font-size:12px;opacity:.6;margin:0">a tiny booth for big little moments.</p>
    </div>
  </body>
</html>`;
}

export async function sendPhotoMail(
  config: Config,
  mail: PhotoMail,
): Promise<void> {
  const payload: Record<string, unknown> = {
    from: config.mailFrom,
    to: [mail.to],
    subject: "Your Boothin' moment is here 📸",
    html: buildHtml(mail.link),
    text:
      "Your Boothin' moment is here.\n\n" +
      `Here's your photo from boothin' by zzuhdamn: ${mail.link}`,
    attachments: [
      {
        filename: mail.filename,
        content: Buffer.from(mail.photo).toString("base64"),
      },
    ],
  };

  await sendResendEmail(config, payload);
}

function ownerSubject(msg: OwnerMessage): string {
  if (msg.type === "feedback") {
    const rating = Math.max(0, Math.min(5, msg.rating ?? 0));
    const stars = "★".repeat(rating) + "☆".repeat(5 - rating);

    return `[boothin'] Feedback ${stars}`;
  }

  const name = singleLine(msg.name).slice(0, 60);

  return name
    ? `[boothin'] Contact: ${name}`
    : "[boothin'] Contact";
}

function ownerHtml(msg: OwnerMessage): string {
  const row = (label: string, value: string): string =>
    `<tr>
      <td style="padding:4px 14px 4px 0;color:#777;vertical-align:top">${label}</td>
      <td style="padding:4px 0">${value}</td>
    </tr>`;

  const rows = [
    row("Type", msg.type === "feedback" ? "Feedback" : "Contact"),
    msg.name ? row("Name", escapeHtml(msg.name)) : "",
    msg.email
      ? row("Email", escapeHtml(msg.email))
      : row("Email", "<em>not provided</em>"),
    msg.rating != null
      ? row("Rating", `${msg.rating} / 5`)
      : "",
  ].join("");

  return `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#eee7dc;font-family:Georgia,serif;color:#171515">
    <div style="max-width:560px;margin:0 auto;background:#fffdf8;padding:28px;border:1px solid #171515">
      <p style="font-size:24px;font-style:italic;margin:0 0 14px">boothin'</p>
      <table style="font-size:14px;border-collapse:collapse;margin-bottom:16px">${rows}</table>
      <div style="white-space:pre-wrap;line-height:1.6;font-size:15px;border-top:1px solid #ddd;padding-top:16px">${escapeHtml(msg.message)}</div>
    </div>
  </body>
</html>`;
}

export type MessageSender = (
  config: Config,
  msg: OwnerMessage,
) => Promise<void>;

/**
 * Mengirim pesan Contact / Feedback ke OWNER_EMAIL.
 * Pesan tidak disimpan di server.
 */
export const sendOwnerMessage: MessageSender = async (config, msg) => {
  if (!config.ownerEmail) {
    throw new OwnerNotConfiguredError();
  }

  const text = [
    `Type: ${msg.type}`,
    msg.name ? `Name: ${msg.name}` : null,
    `Email: ${msg.email || "(not provided)"}`,
    msg.rating != null ? `Rating: ${msg.rating}/5` : null,
    "",
    msg.message,
  ]
    .filter((line): line is string => line !== null)
    .join("\n");

  const payload: Record<string, unknown> = {
    from: config.mailFrom,
    to: [config.ownerEmail],
    subject: ownerSubject(msg),
    html: ownerHtml(msg),
    text,
    ...(msg.email ? { reply_to: msg.email } : {}),
  };

  await sendResendEmail(config, payload);
};
