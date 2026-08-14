import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { Session } from './entities/session.entity';

/** Человекочитаемое имя устройства из User-Agent («Chrome · macOS»). */
export function deviceFromUserAgent(ua?: string): string {
  if (!ua) return 'Неизвестное устройство';
  const browser =
    /Edg\//.test(ua)
      ? 'Edge'
      : /OPR\//.test(ua)
        ? 'Opera'
        : /Chrome\//.test(ua)
          ? 'Chrome'
          : /Safari\//.test(ua)
            ? 'Safari'
            : /Firefox\//.test(ua)
              ? 'Firefox'
              : 'Браузер';
  const os = /iPhone|iPad/.test(ua)
    ? 'iOS'
    : /Android/.test(ua)
      ? 'Android'
      : /Mac OS X/.test(ua)
        ? 'macOS'
        : /Windows/.test(ua)
          ? 'Windows'
          : /Linux/.test(ua)
            ? 'Linux'
            : 'ОС';
  return `${browser} · ${os}`;
}

@Injectable()
export class SessionsService {
  constructor(
    @InjectModel(Session)
    private readonly sessionModel: typeof Session,
  ) {}

  /** Создаёт сессию входа; её id кладётся в JWT как jti. */
  create(
    userId: string,
    meta: { userAgent?: string; ip?: string },
  ): Promise<Session> {
    return this.sessionModel.create({
      user_id: userId,
      device: deviceFromUserAgent(meta.userAgent),
      ip: meta.ip ?? null,
      last_seen: new Date(),
      revoked: false,
    });
  }

  /** Отозвана ли сессия (проверяется в JwtStrategy). */
  async isRevoked(sessionId: string): Promise<boolean> {
    const session = await this.sessionModel.findByPk(sessionId);
    return !session || session.revoked;
  }

  /** Обновляет last_seen не чаще раза в 5 минут. */
  touch(sessionId: string): void {
    void this.sessionModel
      .update(
        { last_seen: new Date() },
        {
          where: {
            id: sessionId,
            last_seen: { [Op.lt]: new Date(Date.now() - 5 * 60 * 1000) },
          },
        },
      )
      .catch(() => undefined);
  }

  list(userId: string): Promise<Session[]> {
    return this.sessionModel.findAll({
      where: { user_id: userId, revoked: false },
      order: [['last_seen', 'DESC']],
      limit: 50,
    });
  }

  async revoke(userId: string, id: string): Promise<void> {
    const [count] = await this.sessionModel.update(
      { revoked: true },
      { where: { id, user_id: userId } },
    );
    if (!count) throw new NotFoundException('Сессия не найдена');
  }

  /** «Выйти везде», кроме текущей сессии. */
  async revokeAll(userId: string, exceptId?: string): Promise<void> {
    const where: Record<string, unknown> = { user_id: userId, revoked: false };
    if (exceptId) where.id = { [Op.ne]: exceptId };
    await this.sessionModel.update({ revoked: true }, { where });
  }
}
