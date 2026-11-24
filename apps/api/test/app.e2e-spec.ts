import { INestApplication } from '@nestjs/common';
import {
  Sentido,
  StatusEstacao,
  StatusLinha,
  StatusTrem,
  TipoConfirmacao,
  TipoReporte,
} from '@sinaleiro/types/enums';
import { Usuario } from '../src/usuarios/entities/usuario.entity.js';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  criarAppE2E,
  criarTokenTeste,
  limparDadosTransacionais,
} from './e2e-setup.js';

interface LinhaResponse {
  id: number;
  nome: string;
  cor: string;
}

interface EstacaoResponse {
  id: number;
  nome: string;
  latitude: number;
  longitude: number;
  linha_id: number;
}

interface EstacaoProximaResponse {
  estacao: EstacaoResponse;
  distancia_metros: number;
  na_estacao: boolean;
  fora_de_alcance: boolean;
}

interface MapaResponse {
  atualizado_em: string;
  linhas: LinhaResponse[];
  estacoes: EstacaoResponse[];
  trens: TremMapaResponse[];
}

interface PerfilResponse {
  usuario: {
    id: string;
    firebase_uid: string;
    nome: string;
    email: string;
    reputacao: number;
  };
  peso: number;
}

interface ErroResponse {
  statusCode: number;
  error: string;
  message: string | string[];
  timestamp: string;
  path: string;
  details?: Record<string, unknown>;
}

interface TremMapaResponse {
  id: string;
  linha_id: number;
  sentido: Sentido;
  id_vagao: string | null;
  status_efetivo: {
    status: StatusTrem;
    confianca: number;
    estacao_id: number | null;
    atualizado_em: string;
  };
}

interface MapaResponse {
  atualizado_em: string;
  linhas: LinhaResponse[];
  estacoes: EstacaoResponse[];
  trens: TremMapaResponse[];
}

describe('Sinaleiro API (E2E)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let estacaoRecife: EstacaoResponse;
  let estacaoJoanaBezerra: EstacaoResponse;

  beforeAll(async () => {
    const setup = await criarAppE2E();
    app = setup.app;
    dataSource = setup.dataSource;

    const resEstacoes = await request(app.getHttpServer())
      .get('/estacoes')
      .expect(200);

    const estacoes = resEstacoes.body as EstacaoResponse[];
    estacaoRecife =
      estacoes.find((e) => e.nome.toLowerCase().includes('recife')) ??
      estacoes[0];
    estacaoJoanaBezerra =
      estacoes.find(
        (e) =>
          e.linha_id === estacaoRecife.linha_id && e.id !== estacaoRecife.id,
      ) ?? estacoes[1];
  });

  beforeEach(async () => {
    await limparDadosTransacionais(dataSource, app);
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('Catálogo Metrorec e Mapa agregado', () => {
    it('GET /mapa retorna linhas e estações populadas pelas migrações e seed', async () => {
      const res = await request(app.getHttpServer()).get('/mapa').expect(200);
      const body = res.body as MapaResponse;

      expect(body.atualizado_em).toBeDefined();
      expect(body.linhas.length).toBeGreaterThanOrEqual(2);
      expect(body.estacoes.length).toBeGreaterThan(0);
    });

    it('GET /linhas e GET /linhas/:id retornam dados válidos e 404 padronizado', async () => {
      const resLista = await request(app.getHttpServer())
        .get('/linhas')
        .expect(200);
      const linhas = resLista.body as LinhaResponse[];
      expect(linhas.length).toBeGreaterThanOrEqual(2);

      const resDetalhe = await request(app.getHttpServer())
        .get(`/linhas/${linhas[0].id}`)
        .expect(200);
      expect((resDetalhe.body as LinhaResponse).nome).toBe(linhas[0].nome);

      const resInexistente = await request(app.getHttpServer())
        .get('/linhas/999999')
        .expect(404);
      const erro = resInexistente.body as ErroResponse;
      expect(erro.statusCode).toBe(404);
      expect(erro.path).toBe('/linhas/999999');
    });

    it('GET /estacoes/proximas encontra estações próximas às coordenadas da Estação Recife', async () => {
      const res = await request(app.getHttpServer())
        .get('/estacoes/proximas')
        .query({
          lat: estacaoRecife.latitude,
          lng: estacaoRecife.longitude,
        })
        .expect(200);

      const proximas = res.body as EstacaoProximaResponse[];
      expect(proximas.length).toBeGreaterThan(0);
      expect(proximas[0].estacao.id).toBe(estacaoRecife.id);
      expect(proximas[0].na_estacao).toBe(true);
      expect(proximas[0].fora_de_alcance).toBe(false);
    });
  });

  describe('Autenticação (/auth/*) e HttpExceptionFilter', () => {
    it('bloqueia acesso sem Bearer token com 401 padronizado', async () => {
      const res = await request(app.getHttpServer())
        .get('/auth/me')
        .expect(401);

      const erro = res.body as ErroResponse;
      expect(erro.statusCode).toBe(401);
      expect(erro.path).toBe('/auth/me');
      expect(erro.timestamp).toBeDefined();
    });

    it('POST /auth/sync e GET /auth/me provisionam e retornam o perfil do passageiro', async () => {
      const token = criarTokenTeste(
        'e2e-carla-01',
        'carla@metrorec.test',
        'Carla Silva',
      );

      const resSync = await request(app.getHttpServer())
        .post('/auth/sync')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const perfilSync = resSync.body as PerfilResponse;
      expect(perfilSync.usuario.firebase_uid).toBe('e2e-carla-01');
      expect(perfilSync.usuario.nome).toBe('Carla Silva');
      expect(perfilSync.peso).toBe(1);

      const resMe = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect((resMe.body as PerfilResponse).usuario.id).toBe(
        perfilSync.usuario.id,
      );
    });

    it('POST /auth/custom-token emite token fora de produção e valida DTO', async () => {
      const resOk = await request(app.getHttpServer())
        .post('/auth/custom-token')
        .send({ uid: 'e2e-local-uid' })
        .expect(200);

      expect((resOk.body as { custom_token: string }).custom_token).toBe(
        'custom-e2e-local-uid',
      );

      const resInvalido = await request(app.getHttpServer())
        .post('/auth/custom-token')
        .send({ uid: '', campoExtra: true })
        .expect(400);

      const erro = resInvalido.body as ErroResponse;
      expect(erro.statusCode).toBe(400);
      expect(Array.isArray(erro.message)).toBe(true);
    });
  });

  describe('Fluxo colaborativo de Reportes e Confirmações', () => {
    it('aplica confiança 0 fora do raio na criação, bloqueia duplicata (409), valida raio de 2 km e atinge quórum de confirmação', async () => {
      const tokenAutor = criarTokenTeste('e2e-autor-01');
      const tokenAutorDistante = criarTokenTeste('e2e-autor-distante-02');

      // Regra 3.2.5 — Criação fora do raio (> 2 km) é aceita com confiança inicial 0
      const resDistante = await request(app.getHttpServer())
        .post('/reportes')
        .set('Authorization', `Bearer ${tokenAutorDistante}`)
        .send({
          tipo: TipoReporte.ESTACAO,
          estacao_id: estacaoRecife.id,
          status_estacao: StatusEstacao.ATENCAO,
          latitude: Number(estacaoRecife.latitude) + 0.1,
          longitude: Number(estacaoRecife.longitude) + 0.1,
        })
        .expect(201);

      // Coordenadas válidas dentro do raio da estação (confiança inicial = peso 1.0 × 10 = 10)
      const resCriado = await request(app.getHttpServer())
        .post('/reportes')
        .set('Authorization', `Bearer ${tokenAutor}`)
        .send({
          tipo: TipoReporte.ESTACAO,
          estacao_id: estacaoRecife.id,
          status_estacao: StatusEstacao.LOTADA,
          latitude: Number(estacaoRecife.latitude),
          longitude: Number(estacaoRecife.longitude),
        })
        .expect(201);

      const reporteDistante = resDistante.body as { confianca: number };
      const reporte = resCriado.body as {
        id: string;
        tipo: TipoReporte;
        status_estacao: StatusEstacao;
        confianca: number;
      };

      expect(reporteDistante.confianca).toBe(0);
      expect(reporte.id).toBeDefined();
      expect(reporte.tipo).toBe(TipoReporte.ESTACAO);
      expect(reporte.status_estacao).toBe(StatusEstacao.LOTADA);
      expect(reporte.confianca).toBe(10);

      // Regra 3.2.1 — Bloqueio de reporte duplicado pelo mesmo autor em 5 min (409 Conflict)
      const resDuplicado = await request(app.getHttpServer())
        .post('/reportes')
        .set('Authorization', `Bearer ${tokenAutor}`)
        .send({
          tipo: TipoReporte.ESTACAO,
          estacao_id: estacaoRecife.id,
          status_estacao: StatusEstacao.LOTADA,
          latitude: Number(estacaoRecife.latitude),
          longitude: Number(estacaoRecife.longitude),
        })
        .expect(409);

      expect((resDuplicado.body as ErroResponse).statusCode).toBe(409);

      // Regra 4.1.4 — Bloqueio de confirmação quando o validador está a mais de 2 km
      const tokenValidador1 = criarTokenTeste('e2e-validador-03');
      await request(app.getHttpServer())
        .post(`/reportes/${reporte.id}/confirmacoes`)
        .set('Authorization', `Bearer ${tokenValidador1}`)
        .send({
          tipo: TipoConfirmacao.CONFIRMAR,
          latitude: Number(estacaoRecife.latitude) + 0.1,
          longitude: Number(estacaoRecife.longitude) + 0.1,
        })
        .expect(400);

      // 1ª confirmação válida (wConfirm = 1.0 < 2.0 -> PENDENTE)
      const resConfirm1 = await request(app.getHttpServer())
        .post(`/reportes/${reporte.id}/confirmacoes`)
        .set('Authorization', `Bearer ${tokenValidador1}`)
        .send({
          tipo: TipoConfirmacao.CONFIRMAR,
          latitude: Number(estacaoRecife.latitude),
          longitude: Number(estacaoRecife.longitude),
        })
        .expect(201);

      expect((resConfirm1.body as { decisao: string }).decisao).toBe('PENDENTE');

      // 2ª confirmação válida atinge quórum (wConfirm = 2.0 >= 2.0 -> CONFIRMADO, confiança = 20)
      const tokenValidador2 = criarTokenTeste('e2e-validador-04');
      const resConfirm2 = await request(app.getHttpServer())
        .post(`/reportes/${reporte.id}/confirmacoes`)
        .set('Authorization', `Bearer ${tokenValidador2}`)
        .send({
          tipo: TipoConfirmacao.CONFIRMAR,
          latitude: Number(estacaoRecife.latitude),
          longitude: Number(estacaoRecife.longitude),
        })
        .expect(201);

      const confirmacao2 = resConfirm2.body as {
        decisao: string;
        reporte: { confianca: number; reputacao_aplicada: boolean };
      };
      expect(confirmacao2.decisao).toBe('CONFIRMADO');
      expect(confirmacao2.reporte.confianca).toBe(20);
      expect(confirmacao2.reporte.reputacao_aplicada).toBe(true);

      // Status agregado da estação reflete o reporte confirmado (confiança 20 >= limiar 15)
      const resStatus = await request(app.getHttpServer())
        .get(`/estacoes/${estacaoRecife.id}/status`)
        .expect(200);

      expect(resStatus.body).toMatchObject({
        status: StatusEstacao.LOTADA,
        confianca: 20,
      });

      // Autor recebeu +3 de reputação pelo reporte confirmado
      const resPerfilAutor = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${tokenAutor}`)
        .expect(200);

      expect((resPerfilAutor.body as PerfilResponse).usuario.reputacao).toBe(3);
    });
  });

  describe('Reportes de Trem (matching e bloqueio em estação fechada)', () => {
    it('exige reputação >= 10 para criar trem inédito (Regra 7.2.2), agrupa reportes no mesmo vagão/sentido (Regra 7.1) e reflete no /mapa (Regra 5.3)', async () => {
      const tokenNovato = criarTokenTeste('e2e-trem-novato-01');
      const tokenVeterano = criarTokenTeste('e2e-trem-veterano-02');
      const tokenPassageiro2 = criarTokenTeste('e2e-trem-passageiro-03');

      // Regra 7.2.2 — Passageiro com reputação 0 não pode registrar trem inédito (403)
      await request(app.getHttpServer())
        .post('/reportes')
        .set('Authorization', `Bearer ${tokenNovato}`)
        .send({
          tipo: TipoReporte.TREM,
          linha_id: estacaoRecife.linha_id,
          sentido: Sentido.CAMARAGIBE,
          estacao_id: estacaoRecife.id,
          id_vagao: 'TUE-101',
          status_trem: StatusTrem.LOTADO,
          latitude: Number(estacaoRecife.latitude),
          longitude: Number(estacaoRecife.longitude),
        })
        .expect(403);

      // Provisiona veterano e eleva reputação para 10
      await request(app.getHttpServer())
        .post('/auth/sync')
        .set('Authorization', `Bearer ${tokenVeterano}`)
        .expect(200);
      await dataSource
        .getRepository(Usuario)
        .update({ firebase_uid: 'e2e-trem-veterano-02' }, { reputacao: 10 });

      // 1º reporte no vagão TUE-101 sentido CAMARAGIBE pelo veterano -> cria trem e reporte (201)
      const resTrem1 = await request(app.getHttpServer())
        .post('/reportes')
        .set('Authorization', `Bearer ${tokenVeterano}`)
        .send({
          tipo: TipoReporte.TREM,
          linha_id: estacaoRecife.linha_id,
          sentido: Sentido.CAMARAGIBE,
          estacao_id: estacaoRecife.id,
          id_vagao: 'TUE-101',
          status_trem: StatusTrem.LOTADO,
          latitude: Number(estacaoRecife.latitude),
          longitude: Number(estacaoRecife.longitude),
        })
        .expect(201);

      const reporteTrem1 = resTrem1.body as {
        id: string;
        tipo: TipoReporte;
        trem_id: string | null;
        linha_id: number | null;
        estacao_id: number | null;
        status_trem: StatusTrem | null;
        confianca: number;
      };

      expect(reporteTrem1.tipo).toBe(TipoReporte.TREM);
      expect(reporteTrem1.trem_id).toBeTruthy();
      // Constraint reporte_alvo_unico: reportes de TREM persistem trem_id e mantêm linha_id nulo
      expect(reporteTrem1.linha_id).toBeNull();
      expect(reporteTrem1.estacao_id).toBe(estacaoRecife.id);
      expect(reporteTrem1.status_trem).toBe(StatusTrem.LOTADO);
      expect(reporteTrem1.confianca).toBe(10);

      // 2º reporte no mesmo vagão/linha/sentido por passageiro com reputação 0 -> reutiliza o trem_id existente
      const resTrem2 = await request(app.getHttpServer())
        .post('/reportes')
        .set('Authorization', `Bearer ${tokenPassageiro2}`)
        .send({
          tipo: TipoReporte.TREM,
          linha_id: estacaoRecife.linha_id,
          sentido: Sentido.CAMARAGIBE,
          estacao_id: estacaoRecife.id,
          id_vagao: 'TUE-101',
          status_trem: StatusTrem.ATRASO,
          latitude: Number(estacaoRecife.latitude),
          longitude: Number(estacaoRecife.longitude),
        })
        .expect(201);

      const reporteTrem2 = resTrem2.body as {
        id: string;
        trem_id: string | null;
        status_trem: StatusTrem | null;
      };

      expect(reporteTrem2.id).not.toBe(reporteTrem1.id);
      expect(reporteTrem2.trem_id).toBe(reporteTrem1.trem_id);

      // 3º reporte com vagão distinto (TUE-202) pelo veterano -> cria um segundo trem
      const resTremOutroVagao = await request(app.getHttpServer())
        .post('/reportes')
        .set('Authorization', `Bearer ${tokenVeterano}`)
        .send({
          tipo: TipoReporte.TREM,
          linha_id: estacaoRecife.linha_id,
          sentido: Sentido.CAMARAGIBE,
          estacao_id: estacaoRecife.id,
          id_vagao: 'TUE-202',
          status_trem: StatusTrem.NORMAL,
          latitude: Number(estacaoRecife.latitude),
          longitude: Number(estacaoRecife.longitude),
        })
        .expect(201);

      const reporteTremOutro = resTremOutroVagao.body as {
        trem_id: string | null;
      };
      expect(reporteTremOutro.trem_id).toBeTruthy();
      expect(reporteTremOutro.trem_id).not.toBe(reporteTrem1.trem_id);

      // Regra 5.3 — GET /mapa exibe o trem ativo com o status válido mais recente (ATRASO)
      const resMapa = await request(app.getHttpServer()).get('/mapa').expect(200);
      const mapa = resMapa.body as MapaResponse;
      const tremNoMapa = mapa.trens.find((t) => t.id === reporteTrem1.trem_id);

      expect(tremNoMapa).toBeDefined();
      expect(tremNoMapa?.id_vagao).toBe('TUE-101');
      expect(tremNoMapa?.status_efetivo.status).toBe(StatusTrem.ATRASO);
    });

    it('bloqueia reporte de TREM com 403 quando a estação de avistamento está FECHADA', async () => {
      const tokenAutorFechada = criarTokenTeste('e2e-fechada-autor-01');
      const tokenValidador1 = criarTokenTeste('e2e-fechada-val-01');
      const tokenValidador2 = criarTokenTeste('e2e-fechada-val-02');
      const tokenPassageiroTrem = criarTokenTeste('e2e-trem-bloqueado-01');

      // Reporta estação como FECHADA e atinge quórum de confirmação (confiança 20 >= 15)
      const resEstacaoFechada = await request(app.getHttpServer())
        .post('/reportes')
        .set('Authorization', `Bearer ${tokenAutorFechada}`)
        .send({
          tipo: TipoReporte.ESTACAO,
          estacao_id: estacaoRecife.id,
          status_estacao: StatusEstacao.FECHADA,
          latitude: Number(estacaoRecife.latitude),
          longitude: Number(estacaoRecife.longitude),
        })
        .expect(201);

      const reporteFechada = resEstacaoFechada.body as { id: string };

      for (const token of [tokenValidador1, tokenValidador2]) {
        await request(app.getHttpServer())
          .post(`/reportes/${reporteFechada.id}/confirmacoes`)
          .set('Authorization', `Bearer ${token}`)
          .send({
            tipo: TipoConfirmacao.CONFIRMAR,
            latitude: Number(estacaoRecife.latitude),
            longitude: Number(estacaoRecife.longitude),
          })
          .expect(201);
      }

      // Tentativa de reportar trem na estação fechada deve retornar 403 Forbidden
      const resBloqueado = await request(app.getHttpServer())
        .post('/reportes')
        .set('Authorization', `Bearer ${tokenPassageiroTrem}`)
        .send({
          tipo: TipoReporte.TREM,
          linha_id: estacaoRecife.linha_id,
          sentido: Sentido.CAMARAGIBE,
          estacao_id: estacaoRecife.id,
          id_vagao: 'TUE-303',
          status_trem: StatusTrem.NORMAL,
          latitude: Number(estacaoRecife.latitude),
          longitude: Number(estacaoRecife.longitude),
        })
        .expect(403);

      const erro = resBloqueado.body as ErroResponse;
      expect(erro.statusCode).toBe(403);
      expect(erro.message).toContain('estação fechada');
    });
  });

  describe('Refutação de reportes e Cooldown pós-refutação', () => {
    it('refuta reporte ao atingir quórum de discordância, penaliza reputações e aplica peso 0.5 no cooldown de 15 min', async () => {
      const tokenAutor = criarTokenTeste('e2e-refutado-autor-01');
      const tokenApoiador = criarTokenTeste('e2e-refutado-apoiador-01');
      const tokensDiscordantes = [
        criarTokenTeste('e2e-refutado-disc-01'),
        criarTokenTeste('e2e-refutado-disc-02'),
        criarTokenTeste('e2e-refutado-disc-03'),
      ];

      // Autor cria reporte de estação PARALISADA dentro do raio (confiança inicial = 10)
      const resReporte = await request(app.getHttpServer())
        .post('/reportes')
        .set('Authorization', `Bearer ${tokenAutor}`)
        .send({
          tipo: TipoReporte.ESTACAO,
          estacao_id: estacaoRecife.id,
          status_estacao: StatusEstacao.PARALISADA,
          latitude: Number(estacaoRecife.latitude),
          longitude: Number(estacaoRecife.longitude),
        })
        .expect(201);

      const reporte = resReporte.body as { id: string; confianca: number };
      expect(reporte.confianca).toBe(10);

      // Um passageiro confirma (wConfirm = 1.0 -> ainda PENDENTE)
      await request(app.getHttpServer())
        .post(`/reportes/${reporte.id}/confirmacoes`)
        .set('Authorization', `Bearer ${tokenApoiador}`)
        .send({
          tipo: TipoConfirmacao.CONFIRMAR,
          latitude: Number(estacaoRecife.latitude),
          longitude: Number(estacaoRecife.longitude),
        })
        .expect(201);

      // 3 discordâncias atingem wDiscord = 3.0 >= wConfirm (1.0) + limiar (1.5) -> REFUTADO
      await request(app.getHttpServer())
        .post(`/reportes/${reporte.id}/confirmacoes`)
        .set('Authorization', `Bearer ${tokensDiscordantes[0]}`)
        .send({
          tipo: TipoConfirmacao.DISCORDAR,
          latitude: Number(estacaoRecife.latitude),
          longitude: Number(estacaoRecife.longitude),
        })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/reportes/${reporte.id}/confirmacoes`)
        .set('Authorization', `Bearer ${tokensDiscordantes[1]}`)
        .send({
          tipo: TipoConfirmacao.DISCORDAR,
          latitude: Number(estacaoRecife.latitude),
          longitude: Number(estacaoRecife.longitude),
        })
        .expect(201);

      const resTerceiraDiscordancia = await request(app.getHttpServer())
        .post(`/reportes/${reporte.id}/confirmacoes`)
        .set('Authorization', `Bearer ${tokensDiscordantes[2]}`)
        .send({
          tipo: TipoConfirmacao.DISCORDAR,
          latitude: Number(estacaoRecife.latitude),
          longitude: Number(estacaoRecife.longitude),
        })
        .expect(201);

      const resultadoRefutacao = resTerceiraDiscordancia.body as {
        decisao: string;
        reporte: { ativo: boolean; reputacao_aplicada: boolean };
      };
      expect(resultadoRefutacao.decisao).toBe('REFUTADO');
      expect(resultadoRefutacao.reporte.ativo).toBe(false);
      expect(resultadoRefutacao.reporte.reputacao_aplicada).toBe(true);

      // Reporte refutado deixa de aparecer na listagem de reportes ativos
      const resAtivos = await request(app.getHttpServer())
        .get('/reportes')
        .query({ alvo: 'estacao', id: estacaoRecife.id })
        .expect(200);

      const ativos = resAtivos.body as Array<{ id: string }>;
      expect(ativos.some((r) => r.id === reporte.id)).toBe(false);

      // Penalidades aplicadas: autor (-5) e apoiador de reporte refutado (-1)
      const resPerfilAutor = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${tokenAutor}`)
        .expect(200);
      expect((resPerfilAutor.body as PerfilResponse).usuario.reputacao).toBe(-5);

      const resPerfilApoiador = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${tokenApoiador}`)
        .expect(200);
      expect((resPerfilApoiador.body as PerfilResponse).usuario.reputacao).toBe(
        -1,
      );

      // Regra 3.2.3 — Novo reporte do autor dentro de 15 min sofre cooldown (peso 0.5 -> confiança 5)
      const resPosCooldown = await request(app.getHttpServer())
        .post('/reportes')
        .set('Authorization', `Bearer ${tokenAutor}`)
        .send({
          tipo: TipoReporte.ESTACAO,
          estacao_id: estacaoRecife.id,
          status_estacao: StatusEstacao.ATENCAO,
          latitude: Number(estacaoRecife.latitude),
          longitude: Number(estacaoRecife.longitude),
        })
        .expect(201);

      expect((resPosCooldown.body as { confianca: number }).confianca).toBe(5);
    });
  });

  describe('Derivação de status da Linha por Estações (Regras 5.2 e 5.2.1)', () => {
    it('ignora estação com confiança < 20 (Regra 5.2.1) e deriva ATENCAO com 1 estação PARALISADA e PARALISADA com 2 estações PARALISADAS (Regra 5.2)', async () => {
      const linhaId = estacaoRecife.linha_id;
      const tokenAutor1 = criarTokenTeste('e2e-linha-autor-01');
      const tokenValidador1 = criarTokenTeste('e2e-linha-val-01');
      const tokenValidador2 = criarTokenTeste('e2e-linha-val-02');
      const tokenAutor2 = criarTokenTeste('e2e-linha-autor-02');
      const tokenValidador3 = criarTokenTeste('e2e-linha-val-03');
      const tokenValidador4 = criarTokenTeste('e2e-linha-val-04');

      // 1. Reporte inicial PARALISADA na Estação Recife sem quórum (confiança = 10 < 20)
      const resRepRecife = await request(app.getHttpServer())
        .post('/reportes')
        .set('Authorization', `Bearer ${tokenAutor1}`)
        .send({
          tipo: TipoReporte.ESTACAO,
          estacao_id: estacaoRecife.id,
          status_estacao: StatusEstacao.PARALISADA,
          latitude: Number(estacaoRecife.latitude),
          longitude: Number(estacaoRecife.longitude),
        })
        .expect(201);

      const reporteRecife = resRepRecife.body as { id: string };

      // Regra 5.2.1 — Confiança 10 (< 20) não contamina o status da linha
      const resLinhaInicial = await request(app.getHttpServer())
        .get(`/linhas/${linhaId}/status`)
        .expect(200);

      expect(resLinhaInicial.body).toMatchObject({
        status: StatusLinha.NORMAL,
        confianca: 0,
      });

      // 2. Duas confirmações elevam a Estação Recife para confiança = 20 (>= 20)
      for (const token of [tokenValidador1, tokenValidador2]) {
        await request(app.getHttpServer())
          .post(`/reportes/${reporteRecife.id}/confirmacoes`)
          .set('Authorization', `Bearer ${token}`)
          .send({
            tipo: TipoConfirmacao.CONFIRMAR,
            latitude: Number(estacaoRecife.latitude),
            longitude: Number(estacaoRecife.longitude),
          })
          .expect(201);
      }

      // Regra 5.2 — 1 estação PARALISADA com confiança >= 20 deriva status ATENCAO na linha
      const resLinhaAtencao = await request(app.getHttpServer())
        .get(`/linhas/${linhaId}/status`)
        .expect(200);

      expect(resLinhaAtencao.body).toMatchObject({
        status: StatusLinha.ATENCAO,
        confianca: 20,
      });

      // 3. Segunda estação da mesma linha (Joana Bezerra) reportada como PARALISADA e confirmada
      const resRepJoana = await request(app.getHttpServer())
        .post('/reportes')
        .set('Authorization', `Bearer ${tokenAutor2}`)
        .send({
          tipo: TipoReporte.ESTACAO,
          estacao_id: estacaoJoanaBezerra.id,
          status_estacao: StatusEstacao.PARALISADA,
          latitude: Number(estacaoJoanaBezerra.latitude),
          longitude: Number(estacaoJoanaBezerra.longitude),
        })
        .expect(201);

      const reporteJoana = resRepJoana.body as { id: string };

      for (const token of [tokenValidador3, tokenValidador4]) {
        await request(app.getHttpServer())
          .post(`/reportes/${reporteJoana.id}/confirmacoes`)
          .set('Authorization', `Bearer ${token}`)
          .send({
            tipo: TipoConfirmacao.CONFIRMAR,
            latitude: Number(estacaoJoanaBezerra.latitude),
            longitude: Number(estacaoJoanaBezerra.longitude),
          })
          .expect(201);
      }

      // Regra 5.2 — 2 estações PARALISADAS com confiança >= 20 derivam status PARALISADA na linha
      const resLinhaParalisada = await request(app.getHttpServer())
        .get(`/linhas/${linhaId}/status`)
        .expect(200);

      expect(resLinhaParalisada.body).toMatchObject({
        status: StatusLinha.PARALISADA,
        confianca: 20,
      });
    });

    it('deriva ATENCAO na linha quando 2 estações distintas atingem ATENCAO com confiança >= 20', async () => {
      const linhaId = estacaoRecife.linha_id;
      const estacoes = [estacaoRecife, estacaoJoanaBezerra];

      for (let i = 0; i < estacoes.length; i++) {
        const estacao = estacoes[i];
        const tokenAutor = criarTokenTeste(`e2e-atencao-autor-${i}`);
        const tokenVal1 = criarTokenTeste(`e2e-atencao-val1-${i}`);
        const tokenVal2 = criarTokenTeste(`e2e-atencao-val2-${i}`);

        const resRep = await request(app.getHttpServer())
          .post('/reportes')
          .set('Authorization', `Bearer ${tokenAutor}`)
          .send({
            tipo: TipoReporte.ESTACAO,
            estacao_id: estacao.id,
            status_estacao: StatusEstacao.ATENCAO,
            latitude: Number(estacao.latitude),
            longitude: Number(estacao.longitude),
          })
          .expect(201);

        const rep = resRep.body as { id: string };

        for (const token of [tokenVal1, tokenVal2]) {
          await request(app.getHttpServer())
            .post(`/reportes/${rep.id}/confirmacoes`)
            .set('Authorization', `Bearer ${token}`)
            .send({
              tipo: TipoConfirmacao.CONFIRMAR,
              latitude: Number(estacao.latitude),
              longitude: Number(estacao.longitude),
            })
            .expect(201);
        }

        const resLinha = await request(app.getHttpServer())
          .get(`/linhas/${linhaId}/status`)
          .expect(200);

        if (i === 0) {
          // Apenas 1 estação em ATENCAO ainda mantém a linha como NORMAL
          expect(resLinha.body).toMatchObject({
            status: StatusLinha.NORMAL,
            confianca: 0,
          });
        } else {
          // 2 estações em ATENCAO derivam ATENCAO na linha
          expect(resLinha.body).toMatchObject({
            status: StatusLinha.ATENCAO,
            confianca: 20,
          });
        }
      }
    });
  });
});
