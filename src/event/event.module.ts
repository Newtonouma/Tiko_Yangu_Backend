import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Event } from './event.entity';
import { EventService } from './event.service';
import { EventController } from './event.controller';
import { AuthModule } from '../auth/auth.module';
import { UserModule } from '../user/user.module';

@Module({
  imports: [TypeOrmModule.forFeature([Event]), AuthModule, UserModule],
  providers: [EventService],
  controllers: [EventController],
  exports: [EventService],
})
export class EventModule {}
