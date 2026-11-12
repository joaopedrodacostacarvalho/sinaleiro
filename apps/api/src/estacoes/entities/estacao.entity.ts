import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, type Relation } from 'typeorm';
import { Linha } from '../../linhas/entities/linha.entity.js';
import { Reporte } from '../../reportes/entities/reporte.entity.js';

@Entity('estacao')
export class Estacao {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 255 })
  nome: String;

  @Column({ type: 'decimal', precision: 10, scale: 8 })
  latitude: number;

  @Column({ type: 'decimal', precision: 11, scale: 8 })
  longitude: number;

  @Column({ type: 'integer' })
  linha_id: number;

  @ManyToOne(() => Linha, (linha) => linha.estacoes)
  @JoinColumn({ name: 'linha_id' })
  linha: Relation<Linha>;

  @OneToMany(() => Reporte, (reporte) => reporte.estacao)
  reportes: Relation<Reporte[]>;
}
