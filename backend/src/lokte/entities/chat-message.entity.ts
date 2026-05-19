import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('chat_messages')
@Index(['shopId', 'userId', 'createdAt'])
export class ChatMessage {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  shopId!: string;

  @Column()
  userId!: string;

  @Column()
  role!: 'user' | 'assistant';

  @Column('text')
  content!: string;

  @Column({ default: false })
  isError!: boolean;

  @CreateDateColumn()
  createdAt!: Date;
}
