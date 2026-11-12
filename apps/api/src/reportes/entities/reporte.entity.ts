import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, type Relation } from 'typeorm';
import { StatusEstacao, StatusLinha, StatusTrem, TipoReporte } from '@sinaleiro/types/enums';
import { Usuario } from '../../usuarios/entities/usuario.entity.js';
import { Trem } from '../../trens/entities/trem.entity.js';
import { ConfirmacaoReporte } from './confirmacao-reporte.entity/confirmacao-reporte.entity.js';
import { Estacao } from '../../estacoes/entities/estacao.entity.js';
import { Linha } from '../../linhas/entities/linha.entity.js';

@Entity('reporte')
export class Reporte {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: TipoReporte })
  tipo: TipoReporte;

  @Column({ type: 'uuid' })
  usuario_id: string;

  @Column({ type: 'uuid', nullable: true })
  trem_id: string | null;

  @Column({ type: 'integer', nullable: true })
  estacao_id: number | null;

  @Column({ type: 'integer', nullable: true })
  linha_id: number | null;

  @Column({ type: 'enum', enum: StatusEstacao, nullable: true })
  status_estacao: StatusEstacao | null;

  @Column({ type: 'enum', enum: StatusLinha, nullable: true })
  status_linha: StatusLinha | null;

  @Column({ type: 'enum', enum: StatusTrem, nullable: true })
  status_trem: StatusTrem | null;

  @Column({ type: 'timestamp' })
  data_hora_criacao: Date;

  @Column({ type: 'timestamp', nullable: true })
  data_hora_expiracao: Date | null;

  @Column({ type: 'integer', default: 0 })
  confianca: number;

  @Column({ type: 'boolean', default: true })
  ativo: boolean;

  @ManyToOne(() => Usuario, (usuario) => usuario.reportes)
  @JoinColumn({ name: 'usuario_id' })
  usuario: Relation<Usuario>;

  @JoinColumn({ name: 'trem_id' })
  trem: Relation<Trem | null>;

  @JoinColumn({ name: 'estacao_id' })
  estacao: Relation<Estacao | null>;

  @JoinColumn({ name: 'linha_id' })
  linha: Relation<Linha | null>;

  @OneToMany(() => ConfirmacaoReporte, (confirmacao) => confirmacao.reporte)
  confirmacoes: Relation<ConfirmacaoReporte[]>;
}
