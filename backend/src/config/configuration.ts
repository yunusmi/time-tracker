export interface AppConfig {
  port: number;
  jwtSecret: string;
  jwtExpiresIn: string;
  frontendUrl: string;
  database: {
    host: string;
    port: number;
    username: string;
    password: string;
    name: string;
  };
  smtp: {
    host: string;
    port: number;
    user: string;
    pass: string;
    from: string;
  };
  integrations: {
    slackWebhookUrl: string;
    telegramBotToken: string;
    telegramChatId: string;
  };
  vapid: {
    publicKey: string;
    privateKey: string;
    subject: string;
  };
}

export default (): AppConfig => ({
  port: parseInt(process.env.PORT ?? '3001', 10),
  jwtSecret: process.env.JWT_SECRET ?? 'super-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:3000',
  database: {
    host: process.env.DB_HOST ?? 'localhost',
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    username: process.env.DB_USERNAME ?? 'postgres',
    password: process.env.DB_PASSWORD ?? 'postgres',
    name: process.env.DB_NAME ?? 'time_tracker',
  },
  smtp: {
    // Без SMTP_HOST письма логируются в консоль (dev-режим).
    host: process.env.SMTP_HOST ?? '',
    port: parseInt(process.env.SMTP_PORT ?? '587', 10),
    user: process.env.SMTP_USER ?? '',
    pass: process.env.SMTP_PASS ?? '',
    from: process.env.MAIL_FROM ?? 'Хронос <no-reply@chronos.local>',
  },
  integrations: {
    // Вебхуки доставки стендапа; без них отправка работает в демо-режиме.
    slackWebhookUrl: process.env.SLACK_WEBHOOK_URL ?? '',
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN ?? '',
    telegramChatId: process.env.TELEGRAM_CHAT_ID ?? '',
  },
  vapid: {
    // Ключи Web Push (npx web-push generate-vapid-keys); без них пуши выключены.
    publicKey: process.env.VAPID_PUBLIC_KEY ?? '',
    privateKey: process.env.VAPID_PRIVATE_KEY ?? '',
    subject: process.env.VAPID_SUBJECT ?? 'mailto:no-reply@chronos.local',
  },
});
