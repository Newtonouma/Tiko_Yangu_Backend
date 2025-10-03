import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from './user.entity';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}
  async updateUser(id: number, update: Partial<User>): Promise<User> {
    await this.userRepository.update(id, update);
    return this.findById(id);
  }

  async findByResetToken(token: string): Promise<User | undefined> {
    const user = await this.userRepository.findOne({
      where: { resetPasswordToken: token },
    });
    return user === null ? undefined : user;
  }

  async findAll(): Promise<User[]> {
    return this.userRepository.find();
  }

  async findById(id: number): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async findByEmail(email: string): Promise<User | undefined> {
    const user = await this.userRepository.findOne({ where: { email } });
    return user === null ? undefined : user;
  }

  async createUser(data: Partial<User> & { role?: UserRole }): Promise<User> {
    if (!data.password) throw new Error('Password is required');
    const hash = await bcrypt.hash(String(data.password), 10);
    const user = this.userRepository.create({
      ...data,
      password: hash,
      role: data.role || UserRole.EVENT_ORGANIZER,
    });
    return await this.userRepository.save(user);
  }

  async createEventOrganizer(data: Partial<User>): Promise<User> {
    return this.createUser({ ...data, role: UserRole.EVENT_ORGANIZER });
  }

  async createAdmin(data: Partial<User>): Promise<User> {
    return this.createUser({ ...data, role: UserRole.ADMIN });
  }

  async deleteUser(id: number): Promise<void> {
    const result = await this.userRepository.delete(id);
    if (!result.affected) throw new NotFoundException('User not found');
  }

  async getUserStatistics(): Promise<{
    totalUsers: number;
    activeUsers: number;
    adminCount: number;
    organizerCount: number;
    attendeeCount: number;
    recentRegistrations: User[];
  }> {
    const totalUsers = await this.userRepository.count();
    const activeUsers = await this.userRepository.count({ 
      where: { isActive: true } 
    });
    const adminCount = await this.userRepository.count({ 
      where: { role: UserRole.ADMIN } 
    });
    const organizerCount = await this.userRepository.count({ 
      where: { role: UserRole.EVENT_ORGANIZER } 
    });
    const attendeeCount = await this.userRepository.count({ 
      where: { role: UserRole.ATTENDEE } 
    });
    
    const recentRegistrations = await this.userRepository.find({
      order: { createdAt: 'DESC' },
      take: 10,
      select: ['id', 'name', 'email', 'role', 'createdAt', 'isActive']
    });

    return {
      totalUsers,
      activeUsers,
      adminCount,
      organizerCount,
      attendeeCount,
      recentRegistrations
    };
  }

  async searchUsers(query: string, role?: UserRole): Promise<User[]> {
    const queryBuilder = this.userRepository.createQueryBuilder('user');
    
    if (query) {
      queryBuilder.where(
        'user.name ILIKE :query OR user.email ILIKE :query',
        { query: `%${query}%` }
      );
    }
    
    if (role) {
      queryBuilder.andWhere('user.role = :role', { role });
    }
    
    return queryBuilder
      .select(['user.id', 'user.name', 'user.email', 'user.role', 'user.isActive', 'user.createdAt'])
      .orderBy('user.createdAt', 'DESC')
      .getMany();
  }

  async updateUserRole(id: number, role: UserRole): Promise<User> {
    const user = await this.findById(id);
    user.role = role;
    return await this.userRepository.save(user);
  }

  async activateUser(id: number): Promise<User> {
    const user = await this.findById(id);
    user.isActive = true;
    return await this.userRepository.save(user);
  }

  async deactivateUser(id: number): Promise<User> {
    const user = await this.findById(id);
    user.isActive = false;
    return await this.userRepository.save(user);
  }
}
