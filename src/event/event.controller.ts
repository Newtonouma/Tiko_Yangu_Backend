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
  @Roles('organizer', 'admin')
  @Get('organizer/:organizerId')
  async listEventsByOrganizer(
    @Param('organizerId') organizerId: number,
    @Req() req: any,
  ) {
    const userId: number = Number(req.user.id);
    if (isNaN(userId)) throw new Error('Invalid user id in request');
    if (userId !== Number(organizerId)) {
      return {
        statusCode: 403,
        message: 'Forbidden: You can only view your own events.',
      };
    }
    return this.eventService.listEventsByOrganizer(userId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('event_organizer')
  @Get('organizer/:organizerId/:eventId')
  async getEventByOrganizer(
    @Param('organizerId') organizerId: number,
    @Param('eventId') eventId: number,
    @Req() req: any,
  ) {
    const userId: number = Number(req.user.id);
    if (isNaN(userId)) throw new Error('Invalid user id in request');
    if (userId !== Number(organizerId)) {
      return {
        statusCode: 403,
        message: 'Forbidden: You can only view your own events.',
      };
    }
    return this.eventService.getEventByOrganizer(userId, eventId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('my')
  async listMyActive(@Req() req: any) {
    console.log('🏢 /events/my called with user:', req.user);
    const userId: number = Number(req.user.id);
    console.log('🏢 User ID:', userId);
    
    if (isNaN(userId)) {
      console.error('❌ Invalid user ID:', req.user.id);
      throw new Error('Invalid user id in request');
    }
    
    const user = await this.userService.findById(userId);
    console.log('🏢 Found user:', user ? 'Yes' : 'No');
    
    // Filter active events for this organizer
    const allActive = await this.eventService.listActiveEvents();
    console.log('🏢 All active events:', allActive.length);
    
    const myEvents = allActive.filter(
      (event) => event.organizer && event.organizer.id === user.id,
    );
    console.log('🏢 My events:', myEvents.length);
    
    return myEvents;
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('organizer', 'admin')
  @Get('my-archived')
  async listMyArchived(@Req() req: any) {
    console.log('🏢 /events/my-archived called with user:', req.user);
    const userId: number = Number(req.user.id);
    
    if (isNaN(userId)) {
      console.error('❌ Invalid user ID:', req.user.id);
      throw new Error('Invalid user id in request');
    }
    
    const user = await this.userService.findById(userId);
    console.log('🏢 Found user for archived:', user ? 'Yes' : 'No');
    
    // Filter archived events for this organizer
    const allArchived = await this.eventService.listArchivedEvents();
    const myArchivedEvents = allArchived.filter(
      (event) => event.organizer && event.organizer.id === user.id,
    );
    
    return myArchivedEvents;
  }
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
    // Use JWT 'id' field as user id (consistent with other methods)
    const userId: number = Number(req.user.id);
    if (isNaN(userId)) {
      throw new Error('Invalid user id in request');
    }
    const organizer = await this.userService.findById(userId);
    return this.eventService.createEvent(
      { ...body, images: imageUrls },
      organizer,
    );
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
    // Use JWT 'id' field as user id (consistent with other methods)
    const userId: number = Number(req.user.id);
    if (isNaN(userId)) {
      throw new Error('Invalid user id in request');
    }
    const user = await this.userService.findById(userId);
    return this.eventService.updateEvent(
      id,
      { ...body, images: imageUrls },
      user,
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Delete(':id')
  async softDelete(@Param('id') id: number, @Req() req: any) {
    // Use JWT 'id' field as user id (consistent with other methods)
    const userId: number = Number(req.user.id);
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
    // Use JWT 'id' field as user id (consistent with other methods)
    const userId: number = Number(req.user.id);
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
  @Get('admin/all')
  async getAllEventsForAdmin() {
    return this.eventService.getAllEventsForAdmin();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Get('admin/statistics')
  async getEventStatistics() {
    return this.eventService.getEventStatistics();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Get('admin/pending')
  async getPendingEvents() {
    return this.eventService.getPendingEvents();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Put('admin/:id/approve')
  async approveEvent(@Param('id') id: number, @Req() req: any) {
    return this.eventService.approveEvent(id, req.user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Put('admin/:id/reject')
  async rejectEvent(@Param('id') id: number, @Body() body: { reason: string }, @Req() req: any) {
    return this.eventService.rejectEvent(id, body.reason, req.user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Put('admin/:id/feature')
  async featureEvent(@Param('id') id: number, @Req() req: any) {
    return this.eventService.featureEvent(id, req.user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Put('admin/:id/unfeature')
  async unfeatureEvent(@Param('id') id: number, @Req() req: any) {
    return this.eventService.unfeatureEvent(id, req.user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Delete('admin/:id')
  async deleteEventAsAdmin(@Param('id') id: number, @Req() req: any) {
    return this.eventService.deleteEventAsAdmin(id, req.user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Get('archived')
  async listArchived() {
    return this.eventService.listArchivedEvents();
  }
}
