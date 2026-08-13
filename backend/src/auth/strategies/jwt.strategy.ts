import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsersService } from '../../users/users.service';

export interface JwtPayload {
  sub: string;
  email: string;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  email_verified_at: Date | null;
  totp_enabled: boolean;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwtSecret') as string,
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    // Ищем по id, а не по email — смена email не инвалидирует активные токены.
    const user = await this.usersService.findByIdOrNull(payload.sub);
    if (!user) {
      throw new UnauthorizedException();
    }
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      email_verified_at: user.email_verified_at,
      totp_enabled: user.totp_enabled,
    };
  }
}
