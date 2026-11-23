import {
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import {
  StatusEstacao,
  StatusLinha,
  StatusTrem,
  TipoReporte,
} from '@sinaleiro/types/enums';
import { Usuario } from '../../usuarios/entities/usuario.entity.js';
import { Trem } from '../../trens/entities/trem.entity.js';
import { ConfirmacaoReporte } from './confirmacao-reporte.entity/confirmacao-reporte.entity.js';
import { Estacao } from '../../estacoes/entities/estacao.entity.js';
import { Linha } from '../../linhas/entities/linha.entity.js';

@Index('idx_reporte_expiracao', ['data_hora_expiracao'], { where: '"ativo" = TRUE' })
@Entity('reporte')
@Check(
  'reporte_alvo_unico',
  `
  (tipo = 'ESTACAO'
    AND estacao_id IS NOT NULL AND status_estacao IS NOT NULL
    AND linha_id IS NULL AND trem_id IS NULL
    AND status_linha IS NULL AND status_trem IS NULL)
  OR
  (tipo = 'LINHA'
    AND linha_id IS NOT NULL AND status_linha IS NOT NULL
    AND estacao_id IS NULL AND trem_id IS NULL
    AND status_estacao IS NULL AND status_trem IS NULL)
  OR
  (tipo = 'TREM'
    AND trem_id IS NOT NULL AND estacao_id IS NOT NULL AND status_trem IS NOT NULL
    AND linha_id IS NULL AND status_estacao IS NULL AND status_linha IS NULL)
`,
)
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

  @Column({ type: 'timestamp' })
  data_hora_expiracao: Date;

  @Column({ type: 'integer', default: 0 })
  confianca: number;

  @Column({ type: 'boolean', default: true })
  ativo: boolean;

  @Column({ type: 'boolean', default: false })
  reputacao_aplicada: boolean;

  @ManyToOne(() => Usuario, (usuario) => usuario.reportes)
  @JoinColumn({ name: 'usuario_id' })
  usuario: Relation<Usuario>;

  @ManyToOne(() => Trem, (trem) => trem.reportes, { nullable: true })
  @JoinColumn({ name: 'trem_id' })
  trem: Relation<Trem | null>;

  @ManyToOne(() => Estacao, (estacao) => estacao.reportes, { nullable: true })
  @JoinColumn({ name: 'estacao_id' })
  estacao: Relation<Estacao | null>;

  @ManyToOne(() => Linha, (linha) => linha.reportes, { nullable: true })
  @JoinColumn({ name: 'linha_id' })
  linha: Relation<Linha | null>;

  @OneToMany(() => ConfirmacaoReporte, (confirmacao) => confirmacao.reporte)
  confirmacoes: Relation<ConfirmacaoReporte[]>;
}
