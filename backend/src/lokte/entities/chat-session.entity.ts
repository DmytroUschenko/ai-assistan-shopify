import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

@Entity('chat_sessions')
@Unique(['shopId', 'userId'])
export class ChatSession {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  shopId!: string;

  @Column()
  userId!: string;

  /** Lokte chat_session_id (UUID) */
  @Column()
  lokteSessionId!: string;

  /** reserved_assistant_message_id from the last Lokte reply — used as parent_message_id on the next send */
  @Column({ type: 'int', nullable: true })
  lastAssistantMsgId!: number | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
