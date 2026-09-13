import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm'

export enum FileStorage {
  HOT = 'hot',
  ARCHIVE = 'archive',
}

@Entity()
export class FileEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ type: 'varchar', length: 255 })
  type: string

  @Column({ type: 'varchar', length: 255 })
  originalName: string

  @Column({ type: 'varchar', length: 255 })
  mimetype: string

  @Column({ type: 'integer' })
  size: number

  @Column('enum', { enum: FileStorage, default: FileStorage.HOT })
  storage: FileStorage

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt: Date
}
