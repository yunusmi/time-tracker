import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SequelizeModule } from '@nestjs/sequelize';
import configuration from './config/configuration';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { TasksModule } from './tasks/tasks.module';
import { TimeEntriesModule } from './time-entries/time-entries.module';
import { PomodoroModule } from './pomodoro/pomodoro.module';
import { ExportModule } from './export/export.module';
import { HealthController } from './health.controller';
import { User } from './users/entities/user.entity';
import { Task } from './tasks/entities/task.entity';
import { TimeEntry } from './time-entries/entities/time-entry.entity';
import { PomodoroSettings } from './pomodoro/entities/pomodoro-settings.entity';
import { PomodoroSession } from './pomodoro/entities/pomodoro-session.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    SequelizeModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        dialect: 'postgres',
        host: config.get<string>('database.host'),
        port: config.get<number>('database.port'),
        username: config.get<string>('database.username'),
        password: config.get<string>('database.password'),
        database: config.get<string>('database.name'),
        models: [User, Task, TimeEntry, PomodoroSettings, PomodoroSession],
        // Dev convenience: auto-create schema. Use migrations in production.
        synchronize: true,
        autoLoadModels: true,
        logging: false,
      }),
    }),
    AuthModule,
    UsersModule,
    TasksModule,
    TimeEntriesModule,
    PomodoroModule,
    ExportModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
