import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Linha } from '../../linhas/entities/linha.entity.js';
import { Estacao } from '../../estacoes/entities/estacao.entity.js';
import { LinhaSentido } from '../../linhas/entities/linha-sentido.entity/linha-sentido.entity.js';
import { METROREC_DATA } from './metrorec.data.js';

const SEED_ADVISORY_LOCK_ID = 739104;

@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    @InjectRepository(Linha)
    private readonly linhaRepo: Repository<Linha>,
  ) { }

  async onApplicationBootstrap(): Promise<void> {
    if (
      process.env.NODE_ENV === 'production' ||
      process.env.NODE_ENV === 'test' ||
      process.env.TYPEORM_MIGRATIONS_RUN === 'true'
    ) {
      return;
    }

    await this.runMetrorecSeed();
  }

  async runMetrorecSeed(): Promise<void> {
    // Fast-path antes de abrir transação se o banco já estiver populado
    const totalInicial = await this.linhaRepo.count();
    if (totalInicial > 0) {
      this.logger.log('Banco já populado. Seed automático ignorado.');
      return;
    }

    try {
      await this.linhaRepo.manager.transaction(
        async (manager: EntityManager) => {
          // Guard contra concorrência no boot simultâneo de múltiplas instâncias
          await manager.query('SELECT pg_advisory_xact_lock($1)', [
            SEED_ADVISORY_LOCK_ID,
          ]);

          const linhaTxRepo = manager.getRepository(Linha);
          const linhaSentidoTxRepo = manager.getRepository(LinhaSentido);
          const estacaoTxRepo = manager.getRepository(Estacao);

          // Revalida dentro da transação após adquirir o lock
          const totalLinhas = await linhaTxRepo.count();
          if (totalLinhas > 0) {
            this.logger.log(
              'Banco já populado por outra instância. Seed ignorado.',
            );
            return;
          }

          this.logger.log(
            'Banco zerado detectado. Populando dados do Metrorec...',
          );

          for (const linhaData of METROREC_DATA) {
            const linha = await linhaTxRepo.save(
              linhaTxRepo.create({
                nome: linhaData.nome,
                cor: linhaData.cor,
              }),
            );

            const sentidos = linhaData.sentidos.map((sentido) =>
              linhaSentidoTxRepo.create({
                linha_id: linha.id,
                sentido,
              }),
            );
            await linhaSentidoTxRepo.save(sentidos);

            const estacoes = linhaData.estacoes.map((estacaoData) =>
              estacaoTxRepo.create({
                nome: estacaoData.nome,
                latitude: estacaoData.latitude,
                longitude: estacaoData.longitude,
                linha_id: linha.id,
              }),
            );
            await estacaoTxRepo.save(estacoes);

            this.logger.log(
              `Linha "${linha.nome}" e suas estações inseridas.`,
            );
          }

          this.logger.log('Seed inicial do Metrorec concluído!');
        },
      );
    } catch (error) {
      this.logger.error(
        'Falha ao executar seed do Metrorec; transação revertida.',
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }
}
