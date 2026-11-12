import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  type Relation,
  Unique,
} from 'typeorm';
import { Reporte } from '../reporte.entity.js';
import { Usuario } from '../../../usuarios/entities/usuario.entity.js';

@Entity('confirmacao_reporte')
@Unique(['reporte_id', 'usuario_id'])
export class ConfirmacaoReporte {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  reporte_id: string;

  @Column({ type: 'uuid' })
  usuario_id: string;

  @Column({ type: 'boolean' })
  confirmacao: boolean;

  @CreateDateColumn({ type: 'timestamp' })
  data_hora: Date;

  @ManyToOne(() => Reporte, (reporte) => reporte.confirmacoes, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'reporte_id' })
  reporte: Relation<Reporte>;

  @ManyToOne(() => Usuario, (usuario) => usuario.confirmacoes)
  @JoinColumn({ name: 'usuario_id' })
  usuario: Relation<Usuario>;
}
