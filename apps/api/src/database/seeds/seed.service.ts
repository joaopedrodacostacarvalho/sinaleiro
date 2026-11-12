import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Linha } from '../../linhas/entities/linha.entity.js';
import { Estacao } from '../../estacoes/entities/estacao.entity.js';
import { LinhaSentido } from '../../linhas/entities/linha-sentido.entity/linha-sentido.entity.js';
import { METROREC_DATA } from './metrorec.data.js';

@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    @InjectRepository(Linha)
    private readonly linhaRepo: Repository<Linha>,
    @InjectRepository(LinhaSentido)
    private readonly linhaSentidoRepo: Repository<LinhaSentido>,
    @InjectRepository(Estacao)
    private readonly estacaoRepo: Repository<Estacao>,
  ) { }

  async onApplicationBootstrap() {
    // evita rodar automaticamente em ambiente de testes automatizados
    if (process.env.NODE_ENV === 'test') return;

    await this.runMetrorecSeed();
  }

  async runMetrorecSeed() {
    // se já houver linhas cadastradas, o banco não está zerado
    const totalLinhas = await this.linhaRepo.count();
    if (totalLinhas > 0) {
      this.logger.log('⏭️ Banco já populado. Seed automático ignorado.');
      return;
    }

    this.logger.log('Banco zerado detectado. Populando dados do Metrorec...');

    for (const linhaData of METROREC_DATA) {
      const linha = this.linhaRepo.create({
        nome: linhaData.nome,
        cor: linhaData.cor,
      });
      await this.linhaRepo.save(linha);

      for (const sentido of linhaData.sentidos) {
        const novoSentido = this.linhaSentidoRepo.create({
          linha_id: linha.id,
          sentido,
        });
        await this.linhaSentidoRepo.save(novoSentido);
      }

      for (const estacaoData of linhaData.estacoes) {
        const novaEstacao = this.estacaoRepo.create({
          nome: estacaoData.nome,
          latitude: estacaoData.latitude,
          longitude: estacaoData.longitude,
          linha_id: linha.id,
        });
        await this.estacaoRepo.save(novaEstacao);
      }

      this.logger.log(`Linha "${linha.nome}" e suas estações inseridas.`);
    }

    this.logger.log('Seed inicial do Metrorec concluído!');
  }
}
