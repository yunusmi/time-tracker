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

  /** Письмо «таймшит возвращён» — с цитатой причины (Emails.dc.html, 7-е). */
  async sendTimesheetReturned(
    to: string,
    name: string,
    weekLabel: string,
    reason: string,
    adminName: string,
  ): Promise<void> {
    const url = `${this.frontendUrl}/dashboard/timesheets`;
    const content = `
      <div style="font-size:21px;font-weight:700;color:#191a1f;margin-bottom:12px">Таймшит возвращён на доработку</div>
      <div style="font-size:14.5px;line-height:1.6;color:#3d3f47;margin-bottom:18px">Здравствуйте, ${name}! ${adminName} вернул(а) ваш таймшит за неделю <b>${weekLabel}</b>. Причина:</div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px"><tr>
        <td style="border-left:3px solid #f87171;background:#fef2f2;border-radius:0 8px 8px 0;padding:12px 16px;font-size:13.5px;line-height:1.55;color:#7f1d1d">${reason}</td>
      </tr></table>
      ${BUTTON(url, 'Исправить и отправить снова')}
      <div style="font-size:12.5px;line-height:1.6;color:#6b6e78;margin-top:24px">Поправьте записи недели и отправьте таймшит на проверку ещё раз.</div>`;
    await this.send(
      to,
      `Таймшит за неделю ${weekLabel} возвращён — Хронос`,
      layout(content),
    );
  }

  /** Письмо «вам назначена задача» — карточка с проектом/приоритетом/дедлайном. */
  async sendTaskAssigned(
    to: string,
    name: string,
    assignerName: string,
    task: {
      title: string;
      project_name: string | null;
      priority: 'high' | 'med' | 'low';
      due_date: string | null;
    },
  ): Promise<void> {
    const url = `${this.frontendUrl}/dashboard/tasks`;
    const prio =
      task.priority === 'high'
        ? '<span style="background:rgba(248,113,113,.12);color:#dc2626;border-radius:6px;padding:2px 10px;font-size:12px;font-weight:600">Высокий</span>'
        : task.priority === 'low'
          ? '<span style="background:#f0f0f3;color:#6b6e78;border-radius:6px;padding:2px 10px;font-size:12px;font-weight:600">Низкий</span>'
          : '<span style="background:rgba(251,191,36,.14);color:#b45309;border-radius:6px;padding:2px 10px;font-size:12px;font-weight:600">Средний</span>';
    const due = task.due_date
      ? `<div style="font-size:12.5px;color:#6b6e78;margin-top:8px">Дедлайн: <b style="color:#191a1f">${task.due_date}</b></div>`
      : '';
    const content = `
      <div style="font-size:21px;font-weight:700;color:#191a1f;margin-bottom:12px">Вам назначена задача</div>
      <div style="font-size:14.5px;line-height:1.6;color:#3d3f47;margin-bottom:18px">Здравствуйте, ${name}! ${assignerName} назначил(а) вам новую задачу:</div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px"><tr>
        <td style="border:1px solid #e4e5ea;border-radius:10px;padding:16px 18px">
          <div style="font-size:15px;font-weight:600;color:#191a1f;margin-bottom:8px">${task.title}</div>
          <div style="font-size:12.5px;color:#6b6e78">${task.project_name ?? 'Без проекта'} · ${prio}</div>
          ${due}
        </td>
      </tr></table>
      ${BUTTON(url, 'Открыть задачи')}`;
    await this.send(to, `Вам назначена задача: «${task.title}» — Хронос`, layout(content));
  }

  /** Дайджест недели: часы, задачи, стрик, топ проекта. */
  async sendWeeklyDigest(
    to: string,
    name: string,
    stats: {
      week_label: string;
      hours_label: string;
      tasks_done: number;
      streak_days: number;
      top_project: string | null;
    },
  ): Promise<void> {
    const url = `${this.frontendUrl}/dashboard/reports`;
    const cell = (label: string, value: string) =>
      `<td width="50%" style="padding:6px"><div style="border:1px solid #e4e5ea;border-radius:10px;padding:14px 16px"><div style="font-size:11.5px;color:#6b6e78;text-transform:uppercase;letter-spacing:.04em;margin-bottom:6px">${label}</div><div style="font-family:monospace;font-size:19px;font-weight:700;color:#191a1f">${value}</div></div></td>`;
    const content = `
      <div style="font-size:21px;font-weight:700;color:#191a1f;margin-bottom:12px">Ваша неделя в Хроносе</div>
      <div style="font-size:14.5px;line-height:1.6;color:#3d3f47;margin-bottom:18px">Здравствуйте, ${name}! Короткая сводка за неделю ${stats.week_label}:</div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px">
        <tr>${cell('Отработано', stats.hours_label)}${cell('Задач готово', String(stats.tasks_done))}</tr>
        <tr>${cell('Серия целей', `${stats.streak_days} дн.`)}${cell('Топ проекта', stats.top_project ?? '—')}</tr>
      </table>
      <div style="margin-top:16px">${BUTTON(url, 'Открыть отчёты')}</div>`;
    await this.send(to, `Дайджест недели ${stats.week_label} — Хронос`, layout(content));
  }

  /** Welcome-письмо после создания компании: 3 шага + кнопки. */
  async sendWelcome(
    to: string,
    name: string,
    workspaceName: string,
  ): Promise<void> {
    const url = `${this.frontendUrl}/dashboard`;
    const step = (n: number, title: string, text: string) =>
      `<table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom:14px"><tr>
        <td style="width:26px;height:26px;border-radius:50%;background:rgba(99,102,241,.12);color:#6366f1;text-align:center;vertical-align:middle;font-size:13px;font-weight:700">${n}</td>
        <td style="padding-left:12px"><div style="font-size:14px;font-weight:600;color:#191a1f">${title}</div><div style="font-size:12.5px;color:#6b6e78;line-height:1.5">${text}</div></td>
      </tr></table>`;
    const content = `
      <div style="font-size:21px;font-weight:700;color:#191a1f;margin-bottom:12px">Добро пожаловать в Хронос!</div>
      <div style="font-size:14.5px;line-height:1.6;color:#3d3f47;margin-bottom:20px">Здравствуйте, ${name}! Компания <b>«${workspaceName}»</b> создана. Три шага, чтобы команда начала трекать время уже сегодня:</div>
      ${step(1, 'Создайте первый проект', 'Проекты раскрашивают таймлайн и собирают отчёты по клиентам.')}
      ${step(2, 'Добавьте задачи', 'Оценка в минутах покажет прогресс «затрекано из оценки».')}
      ${step(3, 'Пригласите команду', 'Email-приглашение или общая ссылка — роли настраиваются в «Команде».')}
      <div style="margin-top:20px">${BUTTON(url, 'Открыть кабинет')}
        <a href="${url}/settings" style="display:inline-block;margin-left:10px;color:#6366f1;font-size:14px;font-weight:600;text-decoration:none;padding:13px 6px">База знаний →</a></div>`;
    await this.send(to, `Добро пожаловать в Хронос, ${name}!`, layout(content));
  }

  /** Письмо сброса пароля (TTL 1ч), с устройством запроса. */
  async sendPasswordReset(
    to: string,
    name: string,
    token: string,
    device: string | null,
  ): Promise<void> {
    const url = `${this.frontendUrl}/reset?token=${token}`;
    const deviceLine = device
      ? `<div style="font-size:12.5px;color:#6b6e78;margin-bottom:18px">Запрос сделан с устройства: <b style="color:#3d3f47">${device}</b></div>`
      : '';
    const content = `
      <div style="font-size:21px;font-weight:700;color:#191a1f;margin-bottom:12px">Сброс пароля</div>
      <div style="font-size:14.5px;line-height:1.6;color:#3d3f47;margin-bottom:10px">Здравствуйте, ${name}! Вы запросили сброс пароля в Хроносе. Нажмите кнопку, чтобы задать новый пароль.</div>
      ${deviceLine}
      ${BUTTON(url, 'Задать новый пароль')}
      <div style="font-size:12.5px;line-height:1.6;color:#6b6e78;margin-top:24px">Ссылка действует 1 час. Если это были не вы — просто проигнорируйте письмо, пароль останется прежним.<br><span style="font-family:monospace;font-size:11.5px;color:#6366f1;word-break:break-all">${url}</span></div>`;
    await this.send(to, 'Сброс пароля — Хронос', layout(content));
  }

  /** Магическая ссылка входа (TTL 15 мин). */
  async sendMagicLink(to: string, name: string, token: string): Promise<void> {
    const url = `${this.frontendUrl}/login?magic=${token}`;
    const content = `
      <div style="font-size:21px;font-weight:700;color:#191a1f;margin-bottom:12px">Вход по ссылке</div>
      <div style="font-size:14.5px;line-height:1.6;color:#3d3f47;margin-bottom:24px">Здравствуйте, ${name}! Нажмите кнопку, чтобы войти в Хронос без пароля.</div>
      ${BUTTON(url, 'Войти в Хронос')}
      <div style="font-size:12.5px;line-height:1.6;color:#6b6e78;margin-top:24px">Ссылка одноразовая и действует 15 минут. Если это были не вы — проигнорируйте письмо.</div>`;
    await this.send(to, 'Ссылка для входа — Хронос', layout(content));
  }
}
