import { Controller, Post, Put, Delete, Patch, Get, Param, Body, Req, UseGuards, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { uploadImagesToSupabase } from './supabase-upload.util';
import { EventService } from './event.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { EventStatus } from './event.entity';

@Controller('events')
export class EventController {
  constructor(private readonly eventService: EventService) {}


  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'event_organizer')
  @Post()
  @UseInterceptors(FilesInterceptor('images'))
  async create(
    @Body() body,
    @Req() req,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    let imageUrls: string[] = [];
    if (files && files.length > 0) {
      imageUrls = await uploadImagesToSupabase(files);
    } else if (body.images && Array.isArray(body.images)) {
      // Accept base64 images from frontend
      imageUrls = await uploadImagesToSupabase(body.images);
    }
    return this.eventService.createEvent({ ...body, images: imageUrls }, req.user);
  }


  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'event_organizer')
  @Put(':id')
  @UseInterceptors(FilesInterceptor('images'))
  async update(
    @Param('id') id: number,
    @Body() body,
    @Req() req,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    let imageUrls: string[] = [];
    if (files && files.length > 0) {
      imageUrls = await uploadImagesToSupabase(files);
    } else if (body.images && Array.isArray(body.images)) {
      imageUrls = await uploadImagesToSupabase(body.images);
    }
    return this.eventService.updateEvent(id, { ...body, images: imageUrls }, req.user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'event_organizer')
  @Delete(':id')
  async softDelete(@Param('id') id: number, @Req() req) {
    return this.eventService.deleteEvent(id, req.user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'event_organizer')
  @Patch(':id/archive')
  async archive(@Param('id') id: number, @Req() req) {
    return this.eventService.archiveEvent(id, req.user);
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
