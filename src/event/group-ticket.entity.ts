import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
} from 'typeorm';
import { Event } from './event.entity';

@Entity()
export class GroupTicket {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ type: 'int', default: 2 })
  memberCount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price: number;

  @ManyToOne(() => Event, (event) => event.groupTickets, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ name: 'eventId' })
  event: Event;

  @Column()
  eventId: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
