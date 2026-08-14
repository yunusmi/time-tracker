import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { User } from '../users/entities/user.entity';

export type OauthProvider = 'google' | 'yandex';

export const OAUTH_PROVIDERS: OauthProvider[] = ['google', 'yandex'];

/** Профиль пользователя, нормализованный из ответа провайдера. */
interface OauthProfile {
  email: string;
  name: string;
  avatar_url: string | null;
}

interface ProviderConfig {
  clientId: string;
  clientSecret: string;
}

/** Подписанный state OAuth-редиректа: защита от CSRF, TTL 10 минут. */
interface OauthState {
  p: OauthProvider;
  purpose: 'oauth-state';
}

/**
 * SSO через Google и Яндекс (Authorization Code Flow).
 *
 * Аккаунт создаётся/находится по почте (ТЗ Auth 2.0); вход через провайдера
 * подтверждает почту. Провайдер активен только при заданных clientId/secret —
 * без кредов кнопка на входе скрыта, а эндпоинты отвечают 503.
 */
@Injectable()
export class OauthService {
  private readonly logger = new Logger(OauthService.name);
  private readonly callbackBase: string;
  private readonly providers: Record<OauthProvider, ProviderConfig>;
  /**
   * Dev/тесты: OAUTH_MOCK_URL перенаправляет token/userinfo-запросы на
   * локальный мок-сервер — полный флоу проверяется без реальных кредов.
   */
  private readonly mockBase: string;

  constructor(
    config: ConfigService,
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
  ) {
    this.callbackBase =
      config.get<string>('oauth.callbackBase') ?? 'http://localhost:3001/api';
    this.mockBase = process.env.OAUTH_MOCK_URL ?? '';
    this.providers = {
      google: {
        clientId: config.get<string>('oauth.google.clientId') ?? '',
        clientSecret: config.get<string>('oauth.google.clientSecret') ?? '',
      },
      yandex: {
        clientId: config.get<string>('oauth.yandex.clientId') ?? '',
        clientSecret: config.get<string>('oauth.yandex.clientSecret') ?? '',
      },
    };
  }

  /** Статус провайдеров для страницы входа (какие кнопки показывать). */
  enabledProviders(): Record<OauthProvider, boolean> {
    return {
      google: this.isEnabled('google'),
      yandex: this.isEnabled('yandex'),
    };
  }

  isEnabled(provider: OauthProvider): boolean {
    const cfg = this.providers[provider];
    return !!(cfg?.clientId && cfg?.clientSecret);
  }

  private requireEnabled(provider: OauthProvider): ProviderConfig {
    if (!OAUTH_PROVIDERS.includes(provider)) {
      throw new BadRequestException('Неизвестный провайдер');
    }
    if (!this.isEnabled(provider)) {
      throw new ServiceUnavailableException(
        'Вход через этого провайдера пока не настроен (нет ключей OAuth)',
      );
    }
    return this.providers[provider];
  }

  private redirectUri(provider: OauthProvider): string {
    return `${this.callbackBase}/auth/oauth/${provider}/callback`;
  }

  /**
   * URL авторизации у провайдера. State — короткоживущий подписанный JWT:
   * stateless-защита от CSRF, переживает рестарт сервера.
   */
  authorizeUrl(provider: OauthProvider): string {
    const cfg = this.requireEnabled(provider);
    const state = this.jwtService.sign(
      { p: provider, purpose: 'oauth-state' } satisfies OauthState,
      { expiresIn: '10m' },
    );

    if (provider === 'google') {
      const params = new URLSearchParams({
        client_id: cfg.clientId,
        redirect_uri: this.redirectUri('google'),
        response_type: 'code',
        scope: 'openid email profile',
        state,
        // Просим только базовый профиль; refresh-токен не нужен.
        prompt: 'select_account',
      });
      return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
    }

    const params = new URLSearchParams({
      client_id: cfg.clientId,
      redirect_uri: this.redirectUri('yandex'),
      response_type: 'code',
      state,
    });
    return `https://oauth.yandex.ru/authorize?${params}`;
  }

  /** Проверка state из callback: подпись, срок и совпадение провайдера. */
  private verifyState(provider: OauthProvider, state: string): void {
    try {
      const payload = this.jwtService.verify<OauthState>(state ?? '');
      if (payload.purpose !== 'oauth-state' || payload.p !== provider) {
        throw new Error('provider mismatch');
      }
    } catch {
      throw new BadRequestException(
        'Ссылка входа устарела или повреждена — попробуйте ещё раз',
      );
    }
  }

  /** Обмен кода на access_token провайдера. */
  private async exchangeCode(
    provider: OauthProvider,
    code: string,
  ): Promise<string> {
    const cfg = this.requireEnabled(provider);
    const tokenUrl = this.mockBase
      ? `${this.mockBase}/${provider}/token`
      : provider === 'google'
        ? 'https://oauth2.googleapis.com/token'
        : 'https://oauth.yandex.ru/token';

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
    });
    // Google требует redirect_uri в token-запросе; Яндексу он не нужен.
    if (provider === 'google') {
      body.set('redirect_uri', this.redirectUri('google'));
    }

    const res = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    const data = (await res.json().catch(() => null)) as {
      access_token?: string;
      error?: string;
      error_description?: string;
    } | null;
    if (!res.ok || !data?.access_token) {
      this.logger.warn(
        `${provider} token exchange failed: ${res.status} ${data?.error ?? ''} ${data?.error_description ?? ''}`,
      );
      throw new BadRequestException(
        'Провайдер не подтвердил вход — попробуйте ещё раз',
      );
    }
    return data.access_token;
  }

  /** Профиль пользователя у провайдера (почта обязательна). */
  private async fetchProfile(
    provider: OauthProvider,
    accessToken: string,
  ): Promise<OauthProfile> {
    if (provider === 'google') {
      const res = await fetch(
        this.mockBase
          ? `${this.mockBase}/google/userinfo`
          : 'https://openidconnect.googleapis.com/v1/userinfo',
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      const data = (await res.json().catch(() => null)) as {
        email?: string;
        name?: string;
        picture?: string;
      } | null;
      if (!res.ok || !data?.email) {
        throw new BadRequestException(
          'Google не вернул почту — проверьте доступ к email в согласии',
        );
      }
      return {
        email: data.email,
        name: data.name || data.email.split('@')[0],
        avatar_url: data.picture ?? null,
      };
    }

    const res = await fetch(
      this.mockBase
        ? `${this.mockBase}/yandex/userinfo`
        : 'https://login.yandex.ru/info?format=json',
      { headers: { Authorization: `OAuth ${accessToken}` } },
    );
    const data = (await res.json().catch(() => null)) as {
      default_email?: string;
      emails?: string[];
      real_name?: string;
      display_name?: string;
      login?: string;
      is_avatar_empty?: boolean;
      default_avatar_id?: string;
    } | null;
    const email = data?.default_email ?? data?.emails?.[0];
    if (!res.ok || !email) {
      throw new BadRequestException(
        'Яндекс не вернул почту — разрешите доступ к email в настройках приложения',
      );
    }
    return {
      email,
      name: data?.real_name || data?.display_name || data?.login || email.split('@')[0],
      avatar_url:
        data && !data.is_avatar_empty && data.default_avatar_id
          ? `https://avatars.yandex.net/get-yapic/${data.default_avatar_id}/islands-200`
          : null,
    };
  }

  /**
   * Полный callback: state → код → профиль → пользователь.
   * Возвращает пользователя; сессию и JWT кабинета выдаёт AuthService.
   */
  async handleCallback(
    provider: OauthProvider,
    code: string,
    state: string,
  ): Promise<User> {
    this.verifyState(provider, state);
    if (!code) {
      throw new BadRequestException('Провайдер не вернул код авторизации');
    }
    const accessToken = await this.exchangeCode(provider, code);
    const profile = await this.fetchProfile(provider, accessToken);
    return this.usersService.findOrCreateFromOauth(provider, profile);
  }
}
