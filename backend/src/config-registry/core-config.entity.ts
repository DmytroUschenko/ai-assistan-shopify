import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  Unique,
} from 'typeorm';

@Entity('core_config')
@Unique('UQ_core_config_shop_id_path', ['shopId', 'path'])
export class CoreConfig {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'shop_id' })
  shopId!: string;

  @Index()
  @Column()
  path!: string;

  /** Stores bool, int, varchar, or JSON objects natively as JSONB */
  @Column({ type: 'jsonb' })
  value!: unknown;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
