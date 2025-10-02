import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
} from 'typeorm';
import { User } from '../user/user.entity';

export enum EventStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  ACTIVE = 'active',
  ARCHIVED = 'archived',
  REJECTED = 'rejected',
  DELETED = 'deleted',
}

@Entity()
export class Event {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  title: string;

  @Column('text')
  description: string;

  @Column('text', { array: true, nullable: true })
  images: string[];

  @Column({ nullable: true })
  url?: string;

  @Column()
  venue: string;

  @Column()
  location: string;

  @Column({ type: 'date' })
  startDate: string;

  @Column({ type: 'date' })
  endDate: string;

  @Column({ type: 'time' })
  startTime: string;

  @Column({ type: 'time' })
  endTime: string;

  // Ticket Types with different prices
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  earlybirdPrice: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  regularPrice: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  vipPrice: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  vvipPrice: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  atTheGatePrice: number;

  // Keep ticketPrice for backward compatibility (will use regularPrice)
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  ticketPrice: number;

  @ManyToOne(() => User, (user) => user.id, { nullable: false, eager: false })
  @JoinColumn({ name: 'organizerId' })
  organizer: User;

  @Column({ type: 'enum', enum: EventStatus, default: EventStatus.PENDING })
  status: EventStatus;

  @Column({ default: false })
  isFeatured: boolean;

  @Column({ nullable: true })
  rejectionReason?: string;

  @Column({ nullable: true })
  approvedBy?: number;

  @Column({ nullable: true })
  approvedAt?: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
