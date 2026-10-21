import type { Config } from "../config.js";
import { escapeHtml, singleLine, type OwnerMessage } from "../lib/message.js";

export class MailNotConfiguredError extends Error {}
export class OwnerNotConfiguredError extends Error {}

export interface PhotoMail {
  to: string;
  link: string;
  photo: Uint8Array;
  filename: string;
}

function buildHtml(link: string) {
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
        <a href="${link}" style="color:#171515">${link}</a>
      </p>
      <p style="font-size:12px;opacity:.6;margin:0">a tiny booth for big little moments.</p>
    </div>
  </body>
</html>`;
}

export async function sendPhotoMail(config: Config, mail: PhotoMail): Promise<void> {
  if (!config.resendApiKey) throw new MailNotConfiguredError();

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: config.mailFrom,
      to: [mail.to],
      subject: "Your Boothin' moment is here 📸",
      html: buildHtml(mail.link),
      text: `Your Boothin' moment is here.\n\nHere's your photo from boothin' by zzuhdamn: ${mail.link}`,
      attachments: [
        { filename: mail.filename, content: Buffer.from(mail.photo).toString("base64") },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Resend menolak email (${response.status})`);
  }
}

function ownerSubject(msg: OwnerMessage): string {
  if (msg.type === "feedback") {
    const stars = "★".repeat(msg.rating ?? 0) + "☆".repeat(5 - (msg.rating ?? 0));
    return `[boothin'] Feedback ${stars}`;
  }
  const who = singleLine(msg.name).slice(0, 60);
  return who ? `[boothin'] Contact: ${who}` : "[boothin'] Contact";
}

function ownerHtml(msg: OwnerMessage): string {
  const row = (label: string, value: string) =>
    `<tr><td style="padding:4px 14px 4px 0;color:#777;vertical-align:top">${label}</td><td style="padding:4px 0">${value}</td></tr>`;

  const rows = [
    row("Type", msg.type === "feedback" ? "Feedback" : "Contact"),
    msg.name ? row("Name", escapeHtml(msg.name)) : "",
    msg.email ? row("Email", escapeHtml(msg.email)) : row("Email", "<em>not provided</em>"),
    msg.rating ? row("Rating", `${msg.rating} / 5`) : "",
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

export type MessageSender = (config: Config, msg: OwnerMessage) => Promise<void>;

/** Kirim pesan dari form Contact / Feedback ke pemilik (OWNER_EMAIL). Pesan tidak disimpan di server. */
export const sendOwnerMessage: MessageSender = async (config, msg) => {
  if (!config.resendApiKey) throw new MailNotConfiguredError();
  if (!config.ownerEmail) throw new OwnerNotConfiguredError();

  const text = [
    `Type: ${msg.type}`,
    msg.name ? `Name: ${msg.name}` : null,
    `Email: ${msg.email || "(not provided)"}`,
    msg.rating ? `Rating: ${msg.rating}/5` : null,
    "",
    msg.message,
  ]
    .filter((line) => line !== null)
    .join("\n");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: config.mailFrom,
      to: [config.ownerEmail],
      subject: ownerSubject(msg),
      html: ownerHtml(msg),
      text,
      // "Reply" di inbox langsung menuju pengirim pesan.
      ...(msg.email ? { reply_to: msg.email } : {}),
    }),
  });

  if (!response.ok) {
    throw new Error(`Resend menolak pesan (${response.status})`);
  }
};
