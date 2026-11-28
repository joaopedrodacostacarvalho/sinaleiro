import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('eventos')
export class Evento {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', nullable: true })
  usuario_id!: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  sessao_id!: string | null;

  @Column({ type: 'varchar', length: 32, default: 'uso' })
  categoria!: string;

  @Column({ type: 'varchar', length: 80 })
  nome!: string;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  propriedades!: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamptz' })
  criado_em!: Date;
}
