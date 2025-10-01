import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Event } from '../event/event.entity';

export enum TicketStatus {
  VALID = 'valid',
  USED = 'used',
  CANCELED = 'canceled',
}

@Entity()
export class Ticket {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Event, (event) => event.id)
  event: Event;

  @Column()
  buyerName: string;

  @Column()
  buyerEmail: string;

  @Column()
  buyerPhone: string;

  @Column()
  ticketType: string;

  @Column('decimal')
  price: number;

  @Column({ type: 'enum', enum: TicketStatus, default: TicketStatus.VALID })
  status: TicketStatus;

  @Column()
  qrCode: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
