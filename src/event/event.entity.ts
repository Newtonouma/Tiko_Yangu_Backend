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
  ACTIVE = 'active',
  ARCHIVED = 'archived',
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

  @Column({ type: 'enum', enum: EventStatus, default: EventStatus.ACTIVE })
  status: EventStatus;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
