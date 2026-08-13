import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

/** Общий каркас письма по дизайну Emails.dc.html (таблично-инлайновая вёрстка). */
function layout(content: string): string {
  return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#ecedf1">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ecedf1;padding:36px 16px">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:14px;overflow:hidden">
        <tr><td style="padding:28px 36px 0;font-family:'Instrument Sans',system-ui,Arial,sans-serif">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr>
            <td style="width:26px;height:26px;border-radius:7px;background:#6366f1;text-align:center;vertical-align:middle;font-size:12px;color:#ffffff;font-weight:700">◎</td>
            <td style="padding-left:10px;font-weight:700;font-size:16px;color:#191a1f">Хронос</td>
          </tr></table>
        </td></tr>
        <tr><td style="padding:28px 36px 36px;font-family:'Instrument Sans',system-ui,Arial,sans-serif">
          ${content}
        </td></tr>
        <tr><td style="border-top:1px solid #eceded;padding:18px 36px;font-family:'Instrument Sans',system-ui,Arial,sans-serif;font-size:12px;color:#8b8f9a;line-height:1.6">
          Не ожидали этого письма? Просто проигнорируйте его.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

const BUTTON = (href: string, label: string) =>
  `<a href="${href}" style="display:inline-block;background:#6366f1;color:#ffffff;border-radius:9px;padding:13px 30px;font-size:14.5px;font-weight:600;text-decoration:none">${label}</a>`;

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: nodemailer.Transporter | null;
  private readonly from: string;
  readonly frontendUrl: string;

  constructor(config: ConfigService) {
    const smtp = config.get<{
      host: string;
      port: number;
      user: string;
      pass: string;
      from: string;
    }>('smtp');
    this.from = smtp?.from ?? 'Хронос <no-reply@chronos.local>';
    this.frontendUrl =
      config.get<string>('frontendUrl') ?? 'http://localhost:3000';
    this.transporter = smtp?.host
      ? nodemailer.createTransport({
          host: smtp.host,
          port: smtp.port,
          secure: smtp.port === 465,
          auth: smtp.user ? { user: smtp.user, pass: smtp.pass } : undefined,
        })
      : null;
    if (!this.transporter) {
      this.logger.warn(
        'SMTP не настроен (SMTP_HOST) — письма логируются в консоль',
      );
    }
  }

  private async send(to: string, subject: string, html: string): Promise<void> {
    if (!this.transporter) {
      // Dev-режим: печатаем ссылку из письма в лог, чтобы можно было пройти флоу.
      const link = html.match(/href="([^"#]+)"/)?.[1] ?? '(нет ссылки)';
      this.logger.log(`[DEV MAIL] to=${to} subject="${subject}" link=${link}`);
      return;
    }
    await this.transporter.sendMail({ from: this.from, to, subject, html });
  }

  /** Письмо верификации почты (дизайн Emails.dc.html, TTL 24ч). */
  async sendVerification(
    to: string,
    name: string,
    token: string,
  ): Promise<void> {
    const url = `${this.frontendUrl}/verify?token=${token}`;
    const content = `
      <div style="font-size:21px;font-weight:700;color:#191a1f;margin-bottom:12px">Подтвердите вашу почту</div>
      <div style="font-size:14.5px;line-height:1.6;color:#3d3f47;margin-bottom:24px">Здравствуйте, ${name}! Вы зарегистрировались в Хроносе с адресом <b>${to}</b>. Нажмите кнопку ниже, чтобы подтвердить почту и открыть все возможности аккаунта.</div>
      ${BUTTON(url, 'Подтвердить почту')}
      <div style="font-size:12.5px;line-height:1.6;color:#6b6e78;margin-top:24px">Ссылка действует 24 часа. Если кнопка не работает, скопируйте адрес в браузер:<br><span style="font-family:monospace;font-size:11.5px;color:#6366f1;word-break:break-all">${url}</span></div>`;
    await this.send(to, 'Подтвердите почту — Хронос', layout(content));
  }

  /** Письмо-приглашение в команду (дизайн Emails.dc.html, TTL 7 дней). */
  async sendInvite(
    to: string,
    inviter: { name: string; email: string },
    workspaceName: string,
    roleLabel: string,
    token: string,
  ): Promise<void> {
    const url = `${this.frontendUrl}/invite/${token}`;
    const initials = inviter.name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join('');
    const content = `
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom:18px"><tr>
        <td style="width:44px;height:44px;border-radius:50%;background:rgba(99,102,241,.12);color:#6366f1;text-align:center;vertical-align:middle;font-size:15px;font-weight:700">${initials}</td>
        <td style="padding-left:12px">
          <div style="font-size:14.5px;font-weight:600;color:#191a1f">${inviter.name}</div>
          <div style="font-size:12.5px;color:#6b6e78">${inviter.email}</div>
        </td>
      </tr></table>
      <div style="font-size:21px;font-weight:700;color:#191a1f;margin-bottom:12px">Вас пригласили в команду</div>
      <div style="font-size:14.5px;line-height:1.6;color:#3d3f47;margin-bottom:18px">${inviter.name} приглашает вас в рабочее пространство <b>«${workspaceName}»</b> — учёт времени, задачи и отчёты команды в одном месте.</div>
      <div style="display:inline-block;background:#f0f0f3;border-radius:8px;padding:8px 14px;font-size:13px;color:#3d3f47;margin-bottom:24px">Ваша роль: <span style="background:rgba(99,102,241,.12);color:#6366f1;border-radius:6px;padding:2px 10px;font-size:12px;font-weight:600">${roleLabel}</span></div>
      <div>${BUTTON(url, 'Принять приглашение')}</div>
      <div style="font-size:12.5px;color:#6b6e78;margin-top:24px">Приглашение действует 7 дней. Участник может вести свои задачи и время; доступ к чужим отчётам есть только у админов.</div>`;
    await this.send(
      to,
      `${inviter.name} приглашает вас в команду «${workspaceName}»`,
      layout(content),
    );
  }
}
