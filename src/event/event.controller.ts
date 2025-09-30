import {
  Controller,
  Post,
  Put,
  Delete,
  Patch,
  Get,
  Param,
  Body,
  Req,
  UseGuards,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { uploadImagesToSupabase } from './supabase-upload.util';
import { EventService } from './event.service';
import { UserService } from '../user/user.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('events')
export class EventController {
  constructor(
    private readonly eventService: EventService,
    private readonly userService: UserService,
  ) {}


  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'event_organizer')
  @Post()
  @UseInterceptors(FilesInterceptor('images'))
  async create(
    @Body() body: any,
    @Req() req: any,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    let imageUrls: string[] = [];
    if (files && files.length > 0) {
      imageUrls = await uploadImagesToSupabase(files);
    } else if (Array.isArray(body?.images)) {
      // Accept base64 images from frontend
      imageUrls = await uploadImagesToSupabase(body.images as string[]);
    }
    // Use JWT 'sub' field as user id
    const userId: number = typeof req.user.sub === 'string' ? parseInt(req.user.sub, 10) : Number(req.user.sub);
    if (isNaN(userId)) {
      throw new Error('Invalid user id in request');
    }
    const organizer = await this.userService.findById(userId);
    return this.eventService.createEvent({ ...body, images: imageUrls }, organizer);
  }


  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'event_organizer')
  @Put(':id')
  @UseInterceptors(FilesInterceptor('images'))
  async update(
    @Param('id') id: number,
    @Body() body: any,
    @Req() req: any,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    let imageUrls: string[] = [];
    if (files && files.length > 0) {
      imageUrls = await uploadImagesToSupabase(files);
    } else if (Array.isArray(body?.images)) {
      imageUrls = await uploadImagesToSupabase(body.images as string[]);
    }
    // Use JWT 'sub' field as user id
    const userId: number = typeof req.user.sub === 'string' ? parseInt(req.user.sub, 10) : Number(req.user.sub);
    if (isNaN(userId)) {
      throw new Error('Invalid user id in request');
    }
    const user = await this.userService.findById(userId);
    return this.eventService.updateEvent(id, { ...body, images: imageUrls }, user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Delete(':id')
  async softDelete(@Param('id') id: number, @Req() req: any) {
    // Use JWT 'sub' field as user id
    const userId: number = typeof req.user.sub === 'string' ? parseInt(req.user.sub, 10) : Number(req.user.sub);
    if (isNaN(userId)) {
      throw new Error('Invalid user id in request');
    }
    const user = await this.userService.findById(userId);
    return this.eventService.deleteEvent(id, user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'event_organizer')
  @Patch(':id/archive')
  async archive(@Param('id') id: number, @Req() req: any) {
    // Use JWT 'sub' field as user id
    const userId: number = typeof req.user.sub === 'string' ? parseInt(req.user.sub, 10) : Number(req.user.sub);
    if (isNaN(userId)) {
      throw new Error('Invalid user id in request');
    }
    const user = await this.userService.findById(userId);
    return this.eventService.archiveEvent(id, user);
  }

  @Get()
  async listActive() {
    return this.eventService.listActiveEvents();
  }

  @Get(':id')
  async getEvent(@Param('id') id: number) {
    return this.eventService.getEvent(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Get('archived')
  async listArchived() {
    return this.eventService.listArchivedEvents();
  }
}
