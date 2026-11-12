import { Entity, PrimaryGeneratedColumn, Column, OneToMany, type Relation } from 'typeorm';
import { LinhaSentido } from './linha-sentido.entity/linha-sentido.entity.js';
import { Estacao } from '../../estacoes/entities/estacao.entity.js';
import { Trem } from '../../trens/entities/trem.entity.js';
import { Reporte } from '../../reportes/entities/reporte.entity.js';

@Entity('linha')
export class Linha {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 255 })
  nome: string;

  @Column({ type: 'char', length: 7 })
  cor: string;

  @OneToMany(() => LinhaSentido, (linhaSentido) => linhaSentido.linha)
  sentidos: Relation<LinhaSentido[]>;

  @OneToMany(() => Estacao, (estacao) => estacao.linha)
  estacoes: Relation<Estacao[]>;

  @OneToMany(() => Trem, (trem) => trem.linha)
  trens: Relation<Trem[]>;

  @OneToMany(() => Reporte, (reporte) => reporte.linha)
  reportes: Relation<Reporte[]>;
}
