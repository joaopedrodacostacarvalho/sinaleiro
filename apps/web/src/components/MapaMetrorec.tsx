import { useEffect } from 'react';
import L from 'leaflet';
import {
  CircleMarker,
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  Tooltip,
  useMap,
} from 'react-leaflet';
import { Box, Divider, Paper, Stack, Typography } from '@mui/material';
import type { EstacaoMapa, LinhaMapa, TremMapa } from '../api/mapa';
import { StatusEstacao } from '../api/types';
import {
  getVisualEstacao,
  getVisualTrem,
  VISUAL_STATUS_ESTACAO,
} from '../constants/statusVisual';

const CENTRO_RECIFE: [number, number] = [-8.0631, -34.8711];

const SIGLAS_ESTACOES: Record<string, string> = {
  Recife: 'REC',
  Joana: 'JOA',
  'Joana Bezerra': 'JOA',
  Afogados: 'AFG',
  Ipiranga: 'IPG',
  Mangueira: 'MNG',
  'Santa Luzia': 'STL',
  Werneck: 'WRK',
  Barro: 'BAR',
  Tejipió: 'TEJ',
  Coqueiral: 'COQ',
  'Alto do Céu': 'ALC',
  Curado: 'CUR',
  Rodoviária: 'ROD',
  Cosme: 'CSM',
  'Cosme e Damião': 'CSM',
  Camaragibe: 'CAM',
  Cavaleiro: 'CAV',
  Floriano: 'FLR',
  'Engenho Velho': 'ENG',
  Jaboatão: 'JAB',
  Imbiribeira: 'IMB',
  'Largo da Paz': 'LGP',
  'Antônio Falcão': 'ATF',
  Shopping: 'SHP',
  Tancredo: 'TNC',
  'Tancredo Neves': 'TNC',
  Aeroporto: 'AER',
  'Porta Larga': 'PTL',
  'Monte dos Guararapes': 'MTG',
  Prazeres: 'PRZ',
  'Cajueiro Seco': 'CAJ',
  Cabo: 'CAB',
};

function resolverCorLinha(linha: LinhaMapa): string {
  if (linha.cor && linha.cor.startsWith('#')) return linha.cor;
  const lower = linha.nome.toLowerCase();
  if (lower.includes('jaboatão') || lower.includes('jaboatao')) return '#f97316';
  if (lower.includes('camaragibe') || lower.includes('centro')) return '#dc2626';
  if (lower.includes('sul')) return '#2563eb';
  if (lower.includes('cabo')) return '#059669';
  if (lower.includes('curado')) return '#0d9488';
  return '#2563eb';
}

function getInfoBaldeacao(nome: string): { secundaria: string; destino: string } | null {
  const norm = nome.trim().toLowerCase();
  if (norm === 'recife' || norm.includes('joana bezerra')) {
    return { secundaria: '#2563eb', destino: 'Integração Centro / Sul' };
  }
  if (norm.includes('coqueiral')) {
    return { secundaria: '#f97316', destino: 'Bifurcação Camaragibe / Jaboatão' };
  }
  if (norm === 'curado') {
    return { secundaria: '#0d9488', destino: 'Integração Centro / VLT Curado' };
  }
  if (norm.includes('cajueiro seco')) {
    return { secundaria: '#059669', destino: 'Integração Sul / VLT Cabo' };
  }
  return null;
}

function obterSiglaEstacao(nome: string): string {
  if (SIGLAS_ESTACOES[nome]) return SIGLAS_ESTACOES[nome];
  const limpa = nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z\s]/g, '')
    .trim();
  const palavras = limpa.split(/\s+/);
  if (palavras.length >= 3) {
    return (palavras[0][0] + palavras[1][0] + palavras[2][0]).toUpperCase();
  }
  return limpa.slice(0, 3).toUpperCase() || 'EST';
}

function isCoordValida(lat: unknown, lng: unknown): boolean {
  const nLat = Number(lat);
  const nLng = Number(lng);
  return Number.isFinite(nLat) && Number.isFinite(nLng) && (nLat !== 0 || nLng !== 0);
}

function ordenarEstacoesTrilho(estacoes: EstacaoMapa[], nomeLinha: string): EstacaoMapa[] {
  const temOrdem = estacoes.some((e) => typeof e.ordem === 'number' && e.ordem > 0);
  if (temOrdem) {
    return [...estacoes].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
  }

  const lower = nomeLinha.toLowerCase();
  const isNorteSul = lower.includes('sul') || lower.includes('cabo');
  return [...estacoes].sort((a, b) =>
    isNorteSul
      ? Number(b.latitude) - Number(a.latitude)
      : Number(b.longitude) - Number(a.longitude),
  );
}

function criarIconeEstacao(
  estacao: EstacaoMapa,
  corLinha: string,
  selecionada: boolean,
): L.DivIcon {
  const visual = getVisualEstacao(estacao.status_efetivo);
  const sigla = obterSiglaEstacao(estacao.nome);
  const baldeacao = getInfoBaldeacao(estacao.nome);
  const escala = selecionada ? 'scale(1.16)' : 'scale(1)';

  const borda = selecionada ? '2.5px solid #0f172a' : '2px solid #ffffff';
  const sombraAnel = baldeacao
    ? `0 0 0 3px ${baldeacao.secundaria}, 0 3px 8px rgba(15, 23, 42, 0.45)`
    : '0 2px 6px rgba(15, 23, 42, 0.35)';
  const fundoBadge = baldeacao
    ? `linear-gradient(135deg, ${corLinha} 52%, ${baldeacao.secundaria} 52%)`
    : corLinha;

  return L.divIcon({
    className: 'sinaleiro-station-marker',
    iconSize: [46, 24],
    iconAnchor: [23, 12],
    html: `
      <div style="
        position: relative;
        width: 46px;
        height: 24px;
        border-radius: 9999px;
        background: ${fundoBadge};
        border: ${borda};
        box-shadow: ${sombraAnel};
        display: flex;
        align-items: center;
        justify-content: center;
        color: #ffffff;
        font-family: system-ui, -apple-system, sans-serif;
        font-size: 10px;
        font-weight: 800;
        letter-spacing: 0.4px;
        transform: ${escala};
        transition: transform 0.15s ease;
      ">
        ${sigla}
        <span style="
          position: absolute;
          top: -4px;
          right: -4px;
          width: 11px;
          height: 11px;
          border-radius: 9999px;
          background: ${visual.color};
          border: 2px solid #ffffff;
          box-shadow: 0 1px 3px rgba(0,0,0,0.4);
        "></span>
      </div>
    `,
  });
}

function criarIconeTrem(trem: TremMapa): L.DivIcon {
  const visual = getVisualTrem(trem.status_efetivo);
  return L.divIcon({
    className: 'sinaleiro-train-marker',
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    html: `
      <div style="
        width:30px;
        height:30px;
        border-radius:8px;
        background:#0f172a;
        border:2.5px solid ${visual.color};
        color:#ffffff;
        display:flex;
        align-items:center;
        justify-content:center;
        box-shadow:0 2px 8px rgba(0,0,0,0.45);
      ">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2c-4 0-8 .5-8 4v9.5C4 17.43 5.57 19 7.5 19L6 20.5v.5h2l2-2h4l2 2h2v-.5L16.5 19c1.93 0 3.5-1.57 3.5-3.5V6c0-3.5-4-4-8-4zM7.5 17c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm3.5-7H6V6h5v4zm5.5 7c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm1.5-7h-5V6h5v4z"/>
        </svg>
      </div>
    `,
  });
}

function ControladorCamera({ centro }: { centro: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (centro && isCoordValida(centro[0], centro[1])) {
      map.flyTo(centro, 14, { duration: 0.8 });
    }
  }, [centro, map]);
  return null;
}

interface MapaMetrorecProps {
  linhas: LinhaMapa[];
  linhaFiltroId: number | null;
  estacaoSelecionadaId: number | null;
  userCoords: { lat: number; lng: number } | null;
  centroFoco: [number, number] | null;
  onSelectEstacao: (estacao: EstacaoMapa, linha: LinhaMapa) => void;
  onSelectTrem: (trem: TremMapa, linha: LinhaMapa) => void;
}

export function MapaMetrorec({
  linhas,
  linhaFiltroId,
  estacaoSelecionadaId,
  userCoords,
  centroFoco,
  onSelectEstacao,
  onSelectTrem,
}: MapaMetrorecProps) {
  const linhasVisiveis = (
    linhaFiltroId ? linhas.filter((l) => l.id === linhaFiltroId) : linhas
  ).filter(Boolean);

  const todasEstacoes = linhas.flatMap((l) => l.estacoes ?? []);
  const estacaoJoanaBezerra = todasEstacoes.find((e) =>
    e.nome.toLowerCase().includes('joana bezerra'),
  );
  const estacaoCoqueiral = todasEstacoes.find((e) =>
    e.nome.toLowerCase().includes('coqueiral'),
  );
  const estacaoCurado = todasEstacoes.find((e) => e.nome.trim().toLowerCase() === 'curado');
  const estacaoCajueiroSeco = todasEstacoes.find((e) =>
    e.nome.toLowerCase().includes('cajueiro seco'),
  );

  const legendaLinhas = [
    { nome: 'Centro · Camaragibe', cor: '#dc2626' },
    { nome: 'Centro · Jaboatão', cor: '#f97316' },
    { nome: 'Linha Sul', cor: '#2563eb' },
    { nome: 'VLT · Cabo / Curado', cor: '#059669' },
  ];

  const legendaStatus: StatusEstacao[] = [
    StatusEstacao.NORMAL,
    StatusEstacao.ATENCAO,
    StatusEstacao.LOTADA,
    StatusEstacao.PARALISADA,
    StatusEstacao.FECHADA,
  ];

  return (
    <Box sx={{ position: 'relative', width: '100%', height: '100%' }}>
      <MapContainer
        center={CENTRO_RECIFE}
        zoom={12}
        style={{ width: '100%', height: '100%' }}
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <ControladorCamera centro={centroFoco} />

        {userCoords && isCoordValida(userCoords.lat, userCoords.lng) && (
          <CircleMarker
            center={[userCoords.lat, userCoords.lng]}
            radius={8}
            pathOptions={{
              color: '#2563eb',
              fillColor: '#3b82f6',
              fillOpacity: 0.9,
              weight: 3,
            }}
          >
            <Popup>Sua localização atual</Popup>
          </CircleMarker>
        )}

        {linhasVisiveis.map((linha) => {
          const estacoesValidas = (linha.estacoes ?? []).filter((e) =>
            isCoordValida(e.latitude, e.longitude),
          );
          const estacoesOrdenadas = ordenarEstacoesTrilho(estacoesValidas, linha.nome);

          const pontosLinha: [number, number][] = estacoesOrdenadas.map((e) => [
            Number(e.latitude),
            Number(e.longitude),
          ]);

          const lower = linha.nome.toLowerCase();

          // Liga Linha Sul diretamente a Joana Bezerra (ponte sobre Largo da Paz)
          if (
            lower.includes('sul') &&
            estacaoJoanaBezerra &&
            isCoordValida(estacaoJoanaBezerra.latitude, estacaoJoanaBezerra.longitude) &&
            !estacoesOrdenadas.some((e) => e.id === estacaoJoanaBezerra.id)
          ) {
            pontosLinha.unshift([
              Number(estacaoJoanaBezerra.latitude),
              Number(estacaoJoanaBezerra.longitude),
            ]);
          }

          // Conecta Ramal Jaboatão em Coqueiral
          if (
            (lower.includes('jaboatão') || lower.includes('jaboatao')) &&
            estacaoCoqueiral &&
            isCoordValida(estacaoCoqueiral.latitude, estacaoCoqueiral.longitude) &&
            !estacoesOrdenadas.some((e) => e.id === estacaoCoqueiral.id)
          ) {
            pontosLinha.unshift([
              Number(estacaoCoqueiral.latitude),
              Number(estacaoCoqueiral.longitude),
            ]);
          }

          // Conecta VLT Curado na estação Curado
          if (
            lower.includes('curado') &&
            estacaoCurado &&
            isCoordValida(estacaoCurado.latitude, estacaoCurado.longitude) &&
            !estacoesOrdenadas.some((e) => e.id === estacaoCurado.id)
          ) {
            pontosLinha.unshift([
              Number(estacaoCurado.latitude),
              Number(estacaoCurado.longitude),
            ]);
          }

          // Conecta VLT Cabo na estação Cajueiro Seco
          if (
            lower.includes('cabo') &&
            estacaoCajueiroSeco &&
            isCoordValida(estacaoCajueiroSeco.latitude, estacaoCajueiroSeco.longitude) &&
            !estacoesOrdenadas.some((e) => e.id === estacaoCajueiroSeco.id)
          ) {
            pontosLinha.unshift([
              Number(estacaoCajueiroSeco.latitude),
              Number(estacaoCajueiroSeco.longitude),
            ]);
          }

          const corTrilho = resolverCorLinha(linha);

          return (
            <div key={linha.id}>
              {pontosLinha.length > 1 && (
                <>
                  <Polyline
                    positions={pontosLinha}
                    pathOptions={{ color: '#ffffff', weight: 9, opacity: 0.95 }}
                  />
                  <Polyline
                    positions={pontosLinha}
                    pathOptions={{ color: corTrilho, weight: 5, opacity: 0.95 }}
                  />
                </>
              )}

              {estacoesOrdenadas.map((estacao) => {
                const visual = getVisualEstacao(estacao.status_efetivo);
                const baldeacao = getInfoBaldeacao(estacao.nome);
                return (
                  <Marker
                    key={`${linha.id}-${estacao.id}`}
                    position={[Number(estacao.latitude), Number(estacao.longitude)]}
                    icon={criarIconeEstacao(
                      estacao,
                      corTrilho,
                      estacao.id === estacaoSelecionadaId,
                    )}
                    eventHandlers={{
                      click: () => onSelectEstacao(estacao, linha),
                    }}
                  >
                    <Tooltip direction="top" offset={[0, -10]}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <span
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            background: visual.color,
                            display: 'inline-block',
                          }}
                        />
                        <strong>{estacao.nome}</strong>
                        {baldeacao ? ` (${baldeacao.destino})` : ''} · {visual.shortLabel}
                      </span>
                    </Tooltip>
                  </Marker>
                );
              })}

              {(linha.trens ?? [])
                .filter((t) => isCoordValida(t.latitude, t.longitude))
                .map((trem) => (
                  <Marker
                    key={trem.id}
                    position={[Number(trem.latitude), Number(trem.longitude)]}
                    icon={criarIconeTrem(trem)}
                    eventHandlers={{
                      click: () => onSelectTrem(trem, linha),
                    }}
                  />
                ))}
            </div>
          );
        })}
      </MapContainer>

      {/* Legenda flutuante compacta */}
      <Paper
        elevation={3}
        sx={{
          position: 'absolute',
          left: 12,
          bottom: { xs: 84, sm: 20 },
          zIndex: 1000,
          px: 1.5,
          py: 1,
          borderRadius: 2.5,
          bgcolor: 'rgba(255, 255, 255, 0.94)',
          backdropFilter: 'blur(6px)',
          maxWidth: { xs: 205, sm: 235 },
        }}
      >
        <Typography
          variant="caption"
          sx={{ fontWeight: 800, display: 'block', mb: 0.5, color: 'text.primary' }}
        >
          Linhas do Metrorec
        </Typography>

        <Stack spacing={0.4} sx={{ mb: 0.75 }}>
          {legendaLinhas.map((item) => (
            <Stack key={item.nome} direction="row" sx={{ alignItems: "center" }} spacing={1}>
              <Box
                sx={{
                  width: 14,
                  height: 4,
                  borderRadius: 1,
                  bgcolor: item.cor,
                  flexShrink: 0,
                }}
              />
              <Typography variant="caption" sx={{ fontSize: 11, lineHeight: 1.2 }}>
                {item.nome}
              </Typography>
            </Stack>
          ))}
        </Stack>

        <Divider sx={{ my: 0.6 }} />

        <Typography
          variant="caption"
          sx={{ fontWeight: 800, display: 'block', mb: 0.4, color: 'text.primary' }}
        >
          Status das estações
        </Typography>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            gap: 0.4,
          }}
        >
          {legendaStatus.map((st) => {
            const cfg = VISUAL_STATUS_ESTACAO[st];
            return (
              <Stack key={st} direction="row" sx={{ alignItems: "center" }} spacing={0.6}>
                <Box
                  sx={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    bgcolor: cfg.color,
                    flexShrink: 0,
                  }}
                />
                <Typography variant="caption" sx={{ fontSize: 10.5, lineHeight: 1.2 }}>
                  {cfg.shortLabel}
                </Typography>
              </Stack>
            );
          })}
        </Box>
      </Paper>
    </Box>
  );
}
