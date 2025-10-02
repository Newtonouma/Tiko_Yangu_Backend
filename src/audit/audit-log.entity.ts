import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../user/user.entity';

export enum AuditAction {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LOGIN = 'login',
  LOGOUT = 'logout',
  APPROVE = 'approve',
  REJECT = 'reject',
  REFUND = 'refund',
  ACTIVATE = 'activate',
  DEACTIVATE = 'deactivate',
  EXPORT = 'export',
  BULK_UPDATE = 'bulk_update',
}

export enum AuditEntityType {
  USER = 'user',
  EVENT = 'event',
  TICKET = 'ticket',
  SETTING = 'setting',
  SYSTEM = 'system',
}

@Entity()
export class AuditLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: 'enum',
    enum: AuditAction,
  })
  action: AuditAction;

  @Column({
    type: 'enum',
    enum: AuditEntityType,
  })
  entityType: AuditEntityType;

  @Column({ nullable: true })
  entityId?: number;

  @Column({ nullable: true })
  entityName?: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'userId' })
  user?: User;

  @Column({ nullable: true })
  userId?: number;

  @Column({ nullable: true })
  userEmail?: string;

  @Column({ nullable: true })
  userRole?: string;

  @Column({ nullable: true })
  ipAddress?: string;

  @Column({ nullable: true })
  userAgent?: string;

  @Column('text', { nullable: true })
  description?: string;

  @Column('jsonb', { nullable: true })
  metadata?: Record<string, any>;

  @Column('jsonb', { nullable: true })
  previousData?: Record<string, any>;

  @Column('jsonb', { nullable: true })
  newData?: Record<string, any>;

  @Column({ default: false })
  isSuccess: boolean;

  @Column({ nullable: true })
  errorMessage?: string;

  @CreateDateColumn()
  createdAt: Date;
}