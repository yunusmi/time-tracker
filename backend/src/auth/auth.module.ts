import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { SequelizeModule } from '@nestjs/sequelize';
import { UsersModule } from '../users/users.module';
import { Session } from './entities/session.entity';
import { AuthService } from './auth.service';
import { OauthService } from './oauth.service';
import { SessionsService } from './sessions.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    SequelizeModule.forFeature([Session]),
    UsersModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('jwtSecret'),
        signOptions: {
          expiresIn: configService.get<string>('jwtExpiresIn'),
        },
      }),
    }),
  ],
  providers: [AuthService, OauthService, SessionsService, JwtStrategy],
  controllers: [AuthController],
  exports: [SessionsService],
})
export class AuthModule {}
