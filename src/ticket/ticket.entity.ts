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
  PENDING = 'pending',
  VALID = 'valid',
  USED = 'used',
  CANCELED = 'canceled',
  REFUNDED = 'refunded',
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

  @Column({ type: 'enum', enum: TicketStatus, default: TicketStatus.PENDING })
  status: TicketStatus;

  @Column()
  qrCode: string;

  // Payment linkage fields
  @Column({ nullable: true })
  paymentProvider?: string; // e.g., 'mpesa'

  @Column({ nullable: true })
  mpesaMerchantRequestId?: string;

  @Column({ nullable: true })
  mpesaCheckoutRequestId?: string;

  // Admin fields
  @Column({ nullable: true })
  refundReason?: string;

  @Column({ nullable: true })
  refundedAt?: Date;

  @Column({ nullable: true })
  refundedBy?: number;

  @Column({ nullable: true })
  lastModifiedBy?: number;

  @Column({ nullable: true })
  lastModifiedAt?: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
