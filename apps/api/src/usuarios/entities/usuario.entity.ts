import { Column, Entity, OneToMany, PrimaryGeneratedColumn, type Relation } from 'typeorm';
import { Reporte } from '../../reportes/entities/reporte.entity.js';
import { ConfirmacaoReporte } from '../../reportes/entities/confirmacao-reporte.entity/confirmacao-reporte.entity.js';

@Entity('usuario')
export class Usuario {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 128, unique: true, nullable: true })
  firebase_uid: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  google_id: string | null;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Column({ type: 'smallint', default: 0 })
  reputacao: number;

  @Column({ type: 'timestamp' })
  data_cadastro: Date;

  @OneToMany(() => Reporte, (reporte) => reporte.usuario)
  reportes: Relation<Reporte[]>;

  @OneToMany(() => ConfirmacaoReporte, (confirmacao) => confirmacao.usuario)
  confirmacoes: Relation<ConfirmacaoReporte[]>;
}

