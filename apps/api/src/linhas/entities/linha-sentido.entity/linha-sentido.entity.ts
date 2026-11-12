import { Sentido } from '@sinaleiro/types/enums';
import { Entity, JoinColumn, ManyToOne, PrimaryColumn, type Relation } from 'typeorm';
import { Linha } from '../linha.entity.js';

@Entity('linha_sentido')
export class LinhaSentido {
  @PrimaryColumn({ type: 'integer' })
  linha_id: number;

  @PrimaryColumn({ type: 'enum', enum: Sentido })
  sentido: Sentido;

  @ManyToOne(() => Linha, (linha) => linha.sentidos, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'linha_id' })
  linha: Relation<Linha>;
}
