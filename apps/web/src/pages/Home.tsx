import { useEffect, useState } from 'react';
import {
  Alert,
  AppBar,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Drawer,
  Fab,
  FormControl,
  IconButton,
  InputLabel,
  LinearProgress,
  Menu,
  MenuItem,
  Paper,
  Select,
  Snackbar,
  Stack,
  Tab,
  Tabs,
  TextField,
  Toolbar,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  Close,
  DirectionsSubway,
  DirectionsSubwayFilled,
  MyLocation,
  Refresh,
  ThumbDownAltOutlined,
  ThumbUpAltOutlined,
  Train,
} from '@mui/icons-material';
import { ApiError } from '../api/client';
import {
  fetchMapa,
  type EstacaoMapa,
  type LinhaMapa,
  type MapaResponse,
  type TremMapa,
} from '../api/mapa';
import {
  confirmarReporte,
  criarReporte,
  fetchReportesAtivos,
} from '../api/reportes';
import {
  StatusEstacao,
  StatusLinha,
  StatusTrem,
  TipoConfirmacao,
  TipoReporte,
  type Reporte,
} from '../api/types';
import { MapaMetrorec } from '../components/MapaMetrorec';
import { StatusIcon } from '../components/StatusIcon';
import {
  getVisualEstacao,
  getVisualLinha,
  getVisualTrem,
  VISUAL_STATUS_ESTACAO,
  VISUAL_STATUS_LINHA,
  VISUAL_STATUS_TREM,
} from '../constants/statusVisual';
import { useEstacoesProximas } from '../hooks/estacoesProximas';
import { useGeolocation } from '../hooks/useGeolocation';
import { useAuth } from '../auth/useAuth';

type AbaReporte = 'ESTACAO' | 'TREM' | 'LINHA';

function formatarTempoRestante(expiracaoIso: string): string {
  const diffMs = new Date(expiracaoIso).getTime() - Date.now();
  if (diffMs <= 0) return 'Expirando...';
  const minutos = Math.ceil(diffMs / 60_000);
  return minutos === 1 ? 'Expira em 1 min' : `Expira em ${minutos} min`;
}

function formatarNomeLinhaCurto(nome: string): string {
  const lower = nome.toLowerCase();
  if (lower.includes('camaragibe')) return 'Centro · Camaragibe';
  if (lower.includes('jaboatão') || lower.includes('jaboatao')) return 'Centro · Jaboatão';
  if (lower.includes('sul')) return 'Linha Sul';
  if (lower.includes('cabo')) return 'VLT · Cabo';
  if (lower.includes('curado')) return 'VLT · Curado';
  return nome.replace(/^linha\s+/i, '');
}

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

export function Home() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { user, perfil, refreshPerfil, signOutUser } = useAuth();
  const geo = useGeolocation();
  const { proximas } = useEstacoesProximas(geo.coords);

  const [mapa, setMapa] = useState<MapaResponse | null>(null);
  const [loadingMapa, setLoadingMapa] = useState(true);
  const [linhaFiltroId, setLinhaFiltroId] = useState<number | null>(null);
  const [centroFoco, setCentroFoco] = useState<[number, number] | null>(null);
  const [focoInicialAplicado, setFocoInicialAplicado] = useState(false);

  // Seleção contextual no Drawer
  const [drawerAberto, setDrawerAberto] = useState(false);
  const [abaAtiva, setAbaAtiva] = useState<AbaReporte>('ESTACAO');
  const [estacaoIdSelecionada, setEstacaoIdSelecionada] = useState<number | null>(null);
  const [linhaIdSelecionada, setLinhaIdSelecionada] = useState<number | null>(null);

  // Campos de reporte de Trem
  const [sentidoTrem, setSentidoTrem] = useState<string>('');
  const [idVagao, setIdVagao] = useState<string>('');

  // Reportes ativos e feedback de ações
  const [reportesAtivos, setReportesAtivos] = useState<Reporte[]>([]);
  const [loadingReportes, setLoadingReportes] = useState(false);
  const [enviandoReporte, setEnviandoReporte] = useState(false);
  const [votandoId, setVotandoId] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<string | null>(null);
  const [erroMsg, setErroMsg] = useState<string | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  // Polling periódico do mapa
  useEffect(() => {
    let ativo = true;

    const sincronizarMapa = async () => {
      try {
        const dados = await fetchMapa();
        if (ativo) {
          setMapa(dados);
          setLoadingMapa(false);
        }
      } catch (err) {
        if (ativo) {
          setErroMsg(
            err instanceof ApiError ? err.message : 'Falha ao carregar o mapa do Metrorec',
          );
          setLoadingMapa(false);
        }
      }
    };

    void sincronizarMapa();
    const timer = window.setInterval(() => {
      void sincronizarMapa();
    }, 20_000);

    return () => {
      ativo = false;
      window.clearInterval(timer);
    };
  }, [refreshTick]);

  // Derivação direta durante o render (compatível com React Compiler)
  const estacaoIdEfetiva =
    estacaoIdSelecionada ?? (proximas.length > 0 ? proximas[0].estacao.id : null);
  const linhaIdEfetiva =
    linhaIdSelecionada ?? (proximas.length > 0 ? proximas[0].estacao.linha_id : null);

  const contextoAtual = (() => {
    if (!mapa?.linhas) return { estacao: null, linha: null };
    if (estacaoIdEfetiva != null) {
      for (const linha of mapa.linhas) {
        const est = (linha.estacoes ?? []).find((e) => e.id === estacaoIdEfetiva);
        if (est) return { estacao: est, linha };
      }
    }
    const linhaFallback =
      mapa.linhas.find((l) => l.id === linhaIdEfetiva) ?? mapa.linhas[0] ?? null;
    return { estacao: null, linha: linhaFallback };
  })();

  const sentidosDisponiveis = contextoAtual.linha?.sentidos ?? [];
  const sentidoTremEfetivo = sentidosDisponiveis.includes(sentidoTrem)
    ? sentidoTrem
    : (sentidosDisponiveis[0] ?? '');

  // Centralização única na estação mais próxima quando o GPS resolve pela primeira vez
  const centroFocoEfetivo: [number, number] | null =
    centroFoco ??
    (!focoInicialAplicado && proximas.length > 0
      ? [Number(proximas[0].estacao.latitude), Number(proximas[0].estacao.longitude)]
      : null);

  const estacaoAlvoId = abaAtiva === 'ESTACAO' ? (contextoAtual.estacao?.id ?? null) : null;
  const linhaAlvoId = abaAtiva === 'LINHA' ? (contextoAtual.linha?.id ?? null) : null;

  // Carrega reportes ativos quando o drawer abre ou muda o alvo
  useEffect(() => {
    if (!drawerAberto) return;
    if (abaAtiva === 'TREM') return;

    const alvo = abaAtiva === 'ESTACAO' ? 'estacao' : 'linha';
    const alvoId = abaAtiva === 'ESTACAO' ? estacaoAlvoId : linhaAlvoId;
    if (alvoId == null) return;

    let ativo = true;
    const buscarReportes = async () => {
      setLoadingReportes(true);
      try {
        const lista = await fetchReportesAtivos(alvo, alvoId);
        if (ativo) setReportesAtivos(lista);
      } catch {
        if (ativo) setReportesAtivos([]);
      } finally {
        if (ativo) setLoadingReportes(false);
      }
    };

    void buscarReportes();
    return () => {
      ativo = false;
    };
  }, [drawerAberto, abaAtiva, estacaoAlvoId, linhaAlvoId, refreshTick]);

  function handleSelectEstacao(estacao: EstacaoMapa, linha: LinhaMapa) {
    setEstacaoIdSelecionada(estacao.id);
    setLinhaIdSelecionada(linha.id);
    setAbaAtiva('ESTACAO');
    setFocoInicialAplicado(true);
    setCentroFoco([Number(estacao.latitude), Number(estacao.longitude)]);
    setDrawerAberto(true);
  }

  function handleSelectTrem(trem: TremMapa, linha: LinhaMapa) {
    setLinhaIdSelecionada(linha.id);
    setSentidoTrem(trem.sentido);
    setIdVagao(trem.id_vagao ?? '');
    setAbaAtiva('TREM');
    setDrawerAberto(true);
  }

  function handleCentralizarGPS() {
    if (geo.coords) {
      setFocoInicialAplicado(true);
      setCentroFoco([geo.coords.lat, geo.coords.lng]);
      if (proximas.length > 0) {
        setEstacaoIdSelecionada(proximas[0].estacao.id);
        setLinhaIdSelecionada(proximas[0].estacao.linha_id);
        setDrawerAberto(true);
      }
    } else {
      setErroMsg(geo.error ?? 'Localização indisponível no navegador.');
    }
  }

  async function enviarReporteEstacao(status: StatusEstacao) {
    if (!contextoAtual.estacao) return;
    setEnviandoReporte(true);
    setErroMsg(null);
    try {
      await criarReporte({
        tipo: TipoReporte.ESTACAO,
        estacao_id: contextoAtual.estacao.id,
        status_estacao: status,
        latitude: geo.coords?.lat,
        longitude: geo.coords?.lng,
      });
      setSnackbar(
        `Status "${getVisualEstacao(status).label}" enviado para ${contextoAtual.estacao.nome}!`,
      );
      setRefreshTick((t) => t + 1);
      await refreshPerfil();
    } catch (err) {
      setErroMsg(err instanceof ApiError ? err.message : 'Erro ao enviar reporte.');
    } finally {
      setEnviandoReporte(false);
    }
  }

  async function enviarReporteTrem(status: StatusTrem) {
    if (!contextoAtual.linha || !sentidoTremEfetivo) return;
    setEnviandoReporte(true);
    setErroMsg(null);
    try {
      await criarReporte({
        tipo: TipoReporte.TREM,
        linha_id: contextoAtual.linha.id,
        estacao_id: contextoAtual.estacao?.id,
        sentido: sentidoTremEfetivo,
        id_vagao: idVagao.trim() || undefined,
        status_trem: status,
        latitude: geo.coords?.lat,
        longitude: geo.coords?.lng,
      });
      setSnackbar(`Reporte de trem (${getVisualTrem(status).label}) registrado!`);
      setRefreshTick((t) => t + 1);
      await refreshPerfil();
    } catch (err) {
      setErroMsg(err instanceof ApiError ? err.message : 'Erro ao reportar trem.');
    } finally {
      setEnviandoReporte(false);
    }
  }

  async function enviarReporteLinha(status: StatusLinha) {
    if (!contextoAtual.linha) return;
    setEnviandoReporte(true);
    setErroMsg(null);
    try {
      await criarReporte({
        tipo: TipoReporte.LINHA,
        linha_id: contextoAtual.linha.id,
        status_linha: status,
        latitude: geo.coords?.lat,
        longitude: geo.coords?.lng,
      });
      setSnackbar(`Status da linha ${formatarNomeLinhaCurto(contextoAtual.linha.nome)} atualizado!`);
      setRefreshTick((t) => t + 1);
      await refreshPerfil();
    } catch (err) {
      setErroMsg(err instanceof ApiError ? err.message : 'Erro ao reportar linha.');
    } finally {
      setEnviandoReporte(false);
    }
  }

  async function handleConfirmacao(reporteId: string, tipo: TipoConfirmacao) {
    setVotandoId(reporteId);
    setErroMsg(null);
    try {
      await confirmarReporte(
        reporteId,
        tipo,
        geo.coords ? { latitude: geo.coords.lat, longitude: geo.coords.lng } : undefined,
      );
      setSnackbar(
        tipo === TipoConfirmacao.CONFIRMAR
          ? 'Reporte confirmado!'
          : 'Discordância registrada.',
      );
      setRefreshTick((t) => t + 1);
      await refreshPerfil();
    } catch (err) {
      setErroMsg(err instanceof ApiError ? err.message : 'Não foi possível registrar seu voto.');
    } finally {
      setVotandoId(null);
    }
  }

  const reputacaoAtual = perfil?.usuario.reputacao ?? 0;
  const pesoVotoAtual = perfil?.peso ?? 1;
  const visualEstacaoAtual = contextoAtual.estacao
    ? getVisualEstacao(contextoAtual.estacao.status_efetivo)
    : null;
  const visualLinhaAtual = contextoAtual.linha
    ? getVisualLinha(contextoAtual.linha.status_efetivo)
    : null;
  const avatarUrlSegura =
    user?.photoURL && (user.photoURL.startsWith('http://') || user.photoURL.startsWith('https://'))
      ? user.photoURL
      : undefined;

  return (
    <Box sx={{ position: 'relative', width: '100vw', height: '100dvh', overflow: 'hidden' }}>
      {/* Barra Superior */}
      <AppBar position="fixed" color="default" elevation={2} sx={{ zIndex: theme.zIndex.drawer + 1 }}>
        <Toolbar sx={{ gap: 1 }}>
          <Train color="primary" />
          <Typography variant="h6" sx={{ fontWeight: 800, letterSpacing: -0.5 }}>
            Sinaleiro
          </Typography>

          <Box sx={{ flexGrow: 1 }} />

          {perfil && (
            <Tooltip title={`Reputação ${reputacaoAtual} · Peso do seu voto: ${pesoVotoAtual}x`}>
              <Chip
                size="small"
                color="primary"
                variant="outlined"
                label={`Rep ${reputacaoAtual} · ${pesoVotoAtual}x`}
              />
            </Tooltip>
          )}

          <Tooltip title="Atualizar mapa">
            <IconButton onClick={() => setRefreshTick((t) => t + 1)} size="small">
              <Refresh />
            </IconButton>
          </Tooltip>

          <IconButton onClick={(e) => setMenuAnchor(e.currentTarget)} size="small">
            <Avatar src={avatarUrlSegura} sx={{ width: 32, height: 32 }}>
              {user?.displayName?.[0] ?? user?.email?.[0] ?? 'P'}
            </Avatar>
          </IconButton>

          <Menu
            anchorEl={menuAnchor}
            open={Boolean(menuAnchor)}
            onClose={() => setMenuAnchor(null)}
          >
            <MenuItem disabled>{perfil?.usuario.nome ?? user?.email}</MenuItem>
            <MenuItem disabled>
              Reputação: {reputacaoAtual} (peso {pesoVotoAtual}x)
            </MenuItem>
            <Divider />
            <MenuItem
              onClick={() => {
                setMenuAnchor(null);
                void signOutUser();
              }}
            >
              Sair
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      {/* Barra Flutuante de Linhas (Seletor compacto no mobile, Chips no desktop) */}
      {isMobile ? (
        <Paper
          elevation={3}
          sx={{
            position: 'fixed',
            top: 64,
            left: 12,
            right: 12,
            zIndex: 1000,
            px: 1.5,
            py: 0.5,
            borderRadius: 99,
            bgcolor: 'rgba(255, 255, 255, 0.96)',
            backdropFilter: 'blur(6px)',
          }}
        >
          <Select
            fullWidth
            size="small"
            variant="standard"
            disableUnderline
            value={linhaFiltroId ?? 'TODAS'}
            onChange={(e) => {
              const val = e.target.value;
              if (val === 'TODAS') {
                setLinhaFiltroId(null);
              } else {
                const id = Number(val);
                setLinhaFiltroId(id);
                setLinhaIdSelecionada(id);
              }
            }}
            sx={{ fontWeight: 700, fontSize: 13 }}
          >
            <MenuItem value="TODAS">
              <Stack direction="row" sx={{ alignItems: "center" }} spacing={1}>
                <DirectionsSubwayFilled fontSize="small" color="primary" />
                <span>Todas as linhas ({mapa?.linhas.length ?? 0})</span>
              </Stack>
            </MenuItem>
            {(mapa?.linhas ?? []).map((linha) => {
              const visualLinha = getVisualLinha(linha.status_efetivo);
              const corTrilho = resolverCorLinha(linha);
              return (
                <MenuItem key={linha.id} value={linha.id}>
                  <Stack direction="row" sx={{ alignItems: "center" }} spacing={1}>
                    <Box
                      sx={{
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        bgcolor: corTrilho,
                        boxShadow: `0 0 0 2px ${visualLinha.color}`,
                        flexShrink: 0,
                      }}
                    />
                    <span>{formatarNomeLinhaCurto(linha.nome)}</span>
                    <Typography variant="caption" color="text.secondary">
                      ({visualLinha.shortLabel})
                    </Typography>
                  </Stack>
                </MenuItem>
              );
            })}
          </Select>
        </Paper>
      ) : (
        <Paper
          elevation={3}
          sx={{
            position: 'fixed',
            top: 72,
            left: 16,
            right: 16,
            zIndex: 1000,
            px: 1.5,
            py: 0.75,
            borderRadius: 99,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            width: 'fit-content',
            maxWidth: 'calc(100vw - 32px)',
            mx: 'auto',
            bgcolor: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(6px)',
          }}
        >
          <Chip
            size="small"
            icon={<DirectionsSubwayFilled />}
            label="Todas"
            color={linhaFiltroId === null ? 'primary' : 'default'}
            variant={linhaFiltroId === null ? 'filled' : 'outlined'}
            onClick={() => setLinhaFiltroId(null)}
            sx={{ fontWeight: 700 }}
          />

          {(mapa?.linhas ?? []).map((linha) => {
            const visualLinha = getVisualLinha(linha.status_efetivo);
            const selecionada = linhaFiltroId === linha.id;
            const corLinha = resolverCorLinha(linha);

            return (
              <Chip
                key={linha.id}
                size="small"
                icon={
                  <Box
                    component="span"
                    sx={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      bgcolor: selecionada ? '#ffffff' : visualLinha.color,
                      ml: 1,
                    }}
                  />
                }
                label={formatarNomeLinhaCurto(linha.nome)}
                onClick={() => {
                  setLinhaFiltroId(selecionada ? null : linha.id);
                  setLinhaIdSelecionada(linha.id);
                }}
                sx={{
                  fontWeight: 700,
                  borderWidth: 2,
                  borderStyle: 'solid',
                  borderColor: corLinha,
                  bgcolor: selecionada ? corLinha : '#ffffff',
                  color: selecionada ? '#ffffff' : '#111827',
                  '&:hover': { opacity: 0.92 },
                }}
              />
            );
          })}
        </Paper>
      )}

      {/* Área Principal do Mapa */}
      <Box
        sx={{
          position: 'fixed',
          top: { xs: 56, sm: 64 },
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 1,
        }}
      >
        {loadingMapa && !mapa ? (
          <Box
            sx={{
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'column',
              gap: 2,
            }}
          >
            <CircularProgress />
            <Typography variant="body2" color="text.secondary">
              Carregando mapa colaborativo do Metrorec...
            </Typography>
          </Box>
        ) : (
          <MapaMetrorec
            linhas={mapa?.linhas ?? []}
            linhaFiltroId={linhaFiltroId}
            estacaoSelecionadaId={estacaoIdEfetiva}
            userCoords={geo.coords}
            centroFoco={centroFocoEfetivo}
            onSelectEstacao={handleSelectEstacao}
            onSelectTrem={handleSelectTrem}
          />
        )}
      </Box>

      {/* Botões Flutuantes Inferiores */}
      <Stack
        direction="row"
        spacing={1.5}
        sx={{
          position: 'fixed',
          bottom: 20,
          right: 16,
          zIndex: 1000,
        }}
      >
        <Fab variant="extended" color="primary" onClick={() => setDrawerAberto(true)}>
          <DirectionsSubway sx={{ mr: 1 }} />
          Reportar agora
        </Fab>

        <Fab color="default" aria-label="Minha localização" onClick={handleCentralizarGPS}>
          <MyLocation />
        </Fab>
      </Stack>

      {/* Drawer Contextual de Estação / Trem / Linha */}
      <Drawer
        anchor={isMobile ? 'bottom' : 'right'}
        open={drawerAberto}
        onClose={() => setDrawerAberto(false)}
        slotProps={{
          paper: {
            sx: {
              width: isMobile ? '100%' : 420,
              maxHeight: isMobile ? '82dvh' : '100dvh',
              borderTopLeftRadius: isMobile ? 16 : 0,
              borderTopRightRadius: isMobile ? 16 : 0,
              pt: isMobile ? 1 : 9,
              px: 2.5,
              pb: 3,
            },
          },
        }}
      >
        <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", mb: 1 }}>
          <Box>
            <Typography variant="overline" color="text.secondary">
              {contextoAtual.linha ? formatarNomeLinhaCurto(contextoAtual.linha.nome) : 'Metrorec'}
            </Typography>
            <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
              {abaAtiva === 'ESTACAO' && contextoAtual.estacao
                ? contextoAtual.estacao.nome
                : abaAtiva === 'TREM'
                  ? `Trens · ${contextoAtual.linha ? formatarNomeLinhaCurto(contextoAtual.linha.nome) : ''}`
                  : contextoAtual.linha
                    ? formatarNomeLinhaCurto(contextoAtual.linha.nome)
                    : 'Linha'}
            </Typography>
          </Box>
          <IconButton onClick={() => setDrawerAberto(false)}>
            <Close />
          </IconButton>
        </Stack>

        <Tabs
          value={abaAtiva}
          onChange={(_, val: AbaReporte) => setAbaAtiva(val)}
          variant="fullWidth"
          sx={{ mb: 2 }}
        >
          <Tab value="ESTACAO" label="Estação" />
          <Tab value="TREM" label="Trem" />
          <Tab value="LINHA" label="Linha" />
        </Tabs>

        {/* ABA ESTAÇÃO */}
        {abaAtiva === 'ESTACAO' && (
          <Stack spacing={2}>
            {contextoAtual.estacao && visualEstacaoAtual ? (
              <>
                <Paper
                  variant="outlined"
                  sx={{
                    p: 1.5,
                    bgcolor: visualEstacaoAtual.bgColor,
                    borderColor: visualEstacaoAtual.borderColor,
                  }}
                >
                  <Stack direction="row" sx={{ alignItems: "center" }} spacing={1}>
                    <StatusIcon
                      iconKey={visualEstacaoAtual.iconKey}
                      color={visualEstacaoAtual.color}
                    />
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                      Status atual: {visualEstacaoAtual.label}
                    </Typography>
                  </Stack>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: 'block', mt: 0.5 }}
                  >
                    Confiança agregada: {contextoAtual.estacao.confianca_efetiva ?? 0}%
                  </Typography>
                </Paper>

                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                  Atualizar situação da estação
                </Typography>

                <Stack spacing={1}>
                  {(Object.keys(VISUAL_STATUS_ESTACAO) as StatusEstacao[]).map((status) => {
                    const cfg = VISUAL_STATUS_ESTACAO[status];
                    return (
                      <Button
                        key={status}
                        variant="outlined"
                        fullWidth
                        disabled={enviandoReporte}
                        startIcon={<StatusIcon iconKey={cfg.iconKey} color={cfg.color} />}
                        onClick={() => void enviarReporteEstacao(status)}
                        sx={{
                          justifyContent: 'flex-start',
                          py: 1.2,
                          borderColor: cfg.borderColor,
                          color: '#111827',
                          fontWeight: 600,
                          '&:hover': { bgcolor: cfg.bgColor, borderColor: cfg.color },
                        }}
                      >
                        {cfg.label}
                      </Button>
                    );
                  })}
                </Stack>

                <Divider />

                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                  Reportes ativos (valide com seu voto)
                </Typography>

                {loadingReportes ? (
                  <LinearProgress />
                ) : reportesAtivos.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    Nenhum reporte recente para esta estação.
                  </Typography>
                ) : (
                  <Stack spacing={1.2}>
                    {reportesAtivos.map((rep) => {
                      const cfg = getVisualEstacao(rep.status_estacao);
                      return (
                        <Paper key={rep.id} variant="outlined" sx={{ p: 1.5 }}>
                          <Stack
                            direction="row"
                            sx={{
                              justifyContent: "space-between",
                              alignItems: "center",
                              mb: 1,
                            }}
                          >
                            <Stack direction="row" sx={{ alignItems: "center" }} spacing={0.8}>
                              <StatusIcon iconKey={cfg.iconKey} color={cfg.color} />
                              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                {cfg.label}
                              </Typography>
                            </Stack>
                            <Chip
                              size="small"
                              label={`Confiança ${rep.confianca}%`}
                              color={rep.confianca >= 50 ? 'success' : 'default'}
                            />
                          </Stack>

                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{ display: 'block', mb: 1 }}
                          >
                            {formatarTempoRestante(rep.data_hora_expiracao)}
                          </Typography>

                          <Stack direction="row" spacing={1}>
                            <Button
                              size="small"
                              variant="contained"
                              color="success"
                              startIcon={<ThumbUpAltOutlined />}
                              disabled={votandoId === rep.id}
                              onClick={() =>
                                void handleConfirmacao(rep.id, TipoConfirmacao.CONFIRMAR)
                              }
                            >
                              Confirmar
                            </Button>
                            <Button
                              size="small"
                              variant="outlined"
                              color="error"
                              startIcon={<ThumbDownAltOutlined />}
                              disabled={votandoId === rep.id}
                              onClick={() =>
                                void handleConfirmacao(rep.id, TipoConfirmacao.DISCORDAR)
                              }
                            >
                              Discordar
                            </Button>
                          </Stack>
                        </Paper>
                      );
                    })}
                  </Stack>
                )}
              </>
            ) : (
              <Alert severity="info">
                Toque em qualquer estação no mapa para visualizar detalhes e enviar reportes.
              </Alert>
            )}
          </Stack>
        )}

        {/* ABA TREM */}
        {abaAtiva === 'TREM' && (
          <Stack spacing={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Linha</InputLabel>
              <Select
                label="Linha"
                value={contextoAtual.linha?.id ?? ''}
                onChange={(e) => setLinhaIdSelecionada(Number(e.target.value))}
              >
                {(mapa?.linhas ?? []).map((l) => (
                  <MenuItem key={l.id} value={l.id}>
                    {formatarNomeLinhaCurto(l.nome)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth size="small">
              <InputLabel>Sentido</InputLabel>
              <Select
                label="Sentido"
                value={sentidoTremEfetivo}
                onChange={(e) => setSentidoTrem(e.target.value)}
              >
                {sentidosDisponiveis.map((sentido) => (
                  <MenuItem key={sentido} value={sentido}>
                    Sentido {sentido}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              size="small"
              label="Prefixo / Vagão (opcional)"
              placeholder="Ex.: TUE-04"
              value={idVagao}
              onChange={(e) => setIdVagao(e.target.value)}
              helperText={
                reputacaoAtual < 10
                  ? 'Reputação < 10: seu reporte será associado a um trem já ativo nesta linha/sentido.'
                  : 'Reputação ≥ 10: você pode registrar um trem inédito ou atualizar um existente.'
              }
            />

            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              Condição do trem
            </Typography>

            <Stack spacing={1}>
              {(Object.keys(VISUAL_STATUS_TREM) as StatusTrem[]).map((status) => {
                const cfg = VISUAL_STATUS_TREM[status];
                return (
                  <Button
                    key={status}
                    variant="outlined"
                    fullWidth
                    disabled={enviandoReporte || !sentidoTremEfetivo}
                    startIcon={<StatusIcon iconKey={cfg.iconKey} color={cfg.color} />}
                    onClick={() => void enviarReporteTrem(status)}
                    sx={{
                      justifyContent: 'flex-start',
                      py: 1.1,
                      borderColor: cfg.borderColor,
                      color: '#111827',
                      fontWeight: 600,
                      '&:hover': { bgcolor: cfg.bgColor, borderColor: cfg.color },
                    }}
                  >
                    {cfg.label}
                  </Button>
                );
              })}
            </Stack>
          </Stack>
        )}

        {/* ABA LINHA */}
        {abaAtiva === 'LINHA' && (
          <Stack spacing={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Linha</InputLabel>
              <Select
                label="Linha"
                value={contextoAtual.linha?.id ?? ''}
                onChange={(e) => setLinhaIdSelecionada(Number(e.target.value))}
              >
                {(mapa?.linhas ?? []).map((l) => (
                  <MenuItem key={l.id} value={l.id}>
                    {formatarNomeLinhaCurto(l.nome)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {contextoAtual.linha && visualLinhaAtual && (
              <Paper
                variant="outlined"
                sx={{
                  p: 1.5,
                  bgcolor: visualLinhaAtual.bgColor,
                  borderColor: visualLinhaAtual.borderColor,
                }}
              >
                <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                  <StatusIcon
                    iconKey={visualLinhaAtual.iconKey}
                    color={visualLinhaAtual.color}
                  />
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    Estado atual: {visualLinhaAtual.label}
                  </Typography>
                </Stack>
              </Paper>
            )}

            <Stack spacing={1}>
              {(Object.keys(VISUAL_STATUS_LINHA) as StatusLinha[]).map((status) => {
                const cfg = VISUAL_STATUS_LINHA[status];
                return (
                  <Button
                    key={status}
                    variant="outlined"
                    fullWidth
                    disabled={enviandoReporte || !contextoAtual.linha}
                    startIcon={<StatusIcon iconKey={cfg.iconKey} color={cfg.color} />}
                    onClick={() => void enviarReporteLinha(status)}
                    sx={{
                      justifyContent: 'flex-start',
                      py: 1.2,
                      borderColor: cfg.borderColor,
                      color: '#111827',
                      fontWeight: 600,
                      '&:hover': { bgcolor: cfg.bgColor, borderColor: cfg.color },
                    }}
                  >
                    {cfg.label}
                  </Button>
                );
              })}
            </Stack>
          </Stack>
        )}
      </Drawer>

      {/* Feedbacks */}
      <Snackbar
        open={Boolean(snackbar)}
        autoHideDuration={3500}
        onClose={() => setSnackbar(null)}
        message={snackbar}
      />

      <Snackbar
        open={Boolean(erroMsg)}
        autoHideDuration={5500}
        onClose={() => setErroMsg(null)}
      >
        <Alert severity="error" onClose={() => setErroMsg(null)} sx={{ width: '100%' }}>
          {erroMsg}
        </Alert>
      </Snackbar>
    </Box>
  );
}
