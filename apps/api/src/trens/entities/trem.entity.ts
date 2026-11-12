import { Sentido } from "@sinaleiro/types/enums";
import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, type Relation } from "typeorm";
import { Linha } from "../../linhas/entities/linha.entity.js";
import { Reporte } from "../../reportes/entities/reporte.entity.js";

@Entity('trem')
export class Trem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'integer', })
  linha_id: number;

  @Column({ type: 'enum', enum: Sentido })
  sentido: Sentido;

  @Column({ type: 'varchar', length: 255, nullable: true })
  id_vagao: string | null;

  @ManyToOne(() => Linha, (linha) => linha.trens)
  @JoinColumn({ name: 'linha_id' })
  linha: Relation<Linha>

  @OneToMany(() => Reporte, (reporte) => reporte.trem)
  reportes: Relation<Reporte[]>;
}
