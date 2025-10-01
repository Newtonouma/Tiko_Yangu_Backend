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

  async createEventOrganizer(data: Partial<User>): Promise<User> {
    if (!data.password) throw new Error('Password is required');
    const hash = await bcrypt.hash(String(data.password), 10);
    const user = this.userRepository.create({
      ...data,
      password: hash,
      role: UserRole.EVENT_ORGANIZER,
    });
    return await this.userRepository.save(user);
  }

  async createAdmin(data: Partial<User>): Promise<User> {
    if (!data.password) throw new Error('Password is required');
    const hash = await bcrypt.hash(String(data.password), 10);
    const user = this.userRepository.create({
      ...data,
      password: hash,
      role: UserRole.ADMIN,
    });
    return await this.userRepository.save(user);
  }

  async deleteUser(id: number): Promise<void> {
    const result = await this.userRepository.delete(id);
    if (!result.affected) throw new NotFoundException('User not found');
  }
}
