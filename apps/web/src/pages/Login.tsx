import { useState, type SubmitEvent } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { Key, Login as LoginIcon, Train } from '@mui/icons-material';
import { apiFetch, ApiError } from '../api/client';
import { useAuth } from '../auth/useAuth';

type ModoLogin = 'GOOGLE' | 'TOKEN';

export function Login() {
  const { signIn, signInWithToken } = useAuth();
  const [modo, setModo] = useState<ModoLogin>('GOOGLE');
  const [customToken, setCustomToken] = useState('');
  const [uidDev, setUidDev] = useState('passageiro-dev-01');
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const isDev = import.meta.env.DEV;

  async function handleGoogleLogin() {
    setCarregando(true);
    setErro(null);
    try {
      await signIn();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Falha ao autenticar com o Google.');
    } finally {
      setCarregando(false);
    }
  }

  async function handleTokenSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!customToken.trim()) return;
    setCarregando(true);
    setErro(null);
    try {
      await signInWithToken(customToken);
    } catch (err) {
      setErro(
        err instanceof Error ? err.message : 'Token inválido ou expirado.',
      );
    } finally {
      setCarregando(false);
    }
  }

  async function handleGerarTokenDev() {
    if (!uidDev.trim()) return;
    setCarregando(true);
    setErro(null);
    try {
      const res = await apiFetch<{ custom_token: string }>('/auth/custom-token', {
        method: 'POST',
        body: JSON.stringify({ uid: uidDev.trim() }),
      });
      await signInWithToken(res.custom_token);
    } catch (err) {
      setErro(
        err instanceof ApiError
          ? err.message
          : 'Não foi possível emitir custom token em desenvolvimento.',
      );
    } finally {
      setCarregando(false);
    }
  }

  return (
    <Box
      sx={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        px: 2,
        background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 55%, #dc2626 100%)',
      }}
    >
      <Card sx={{ maxWidth: 440, width: '100%', borderRadius: 4, boxShadow: 12 }}>
        <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
          <Stack spacing={2.5} sx={{ alignItems: "center" }}>
            <Box
              sx={{
                width: 64,
                height: 64,
                borderRadius: 3,
                bgcolor: 'primary.main',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: 3,
              }}
            >
              <Train sx={{ fontSize: 38 }} />
            </Box>

            <Box sx={{ textAlign: 'center' }} >
              <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: -0.5 }}>
                Sinaleiro
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                Monitoramento colaborativo em tempo real das linhas, estações e trens do Metrô do Recife.
              </Typography>
            </Box>

            <Stack direction="row" spacing={1}>
              <Chip size="small" label="🔴 Centro-1" variant="outlined" />
              <Chip size="small" label="🟠 Centro-2" variant="outlined" />
              <Chip size="small" label="🔵 Sul" variant="outlined" />
            </Stack>

            <Tabs
              value={modo}
              onChange={(_, v: ModoLogin) => {
                setModo(v);
                setErro(null);
              }}
              variant="fullWidth"
              sx={{ width: '100%' }}
            >
              <Tab value="GOOGLE" label="Conta Google" />
              <Tab value="TOKEN" label="Custom Token" />
            </Tabs>

            {erro && (
              <Alert severity="error" sx={{ width: '100%' }}>
                {erro}
              </Alert>
            )}

            {modo === 'GOOGLE' ? (
              <Button
                variant="contained"
                size="large"
                fullWidth
                disabled={carregando}
                startIcon={<LoginIcon />}
                onClick={() => void handleGoogleLogin()}
                sx={{ py: 1.4, fontWeight: 700 }}
              >
                {carregando ? 'Conectando...' : 'Entrar com o Google'}
              </Button>
            ) : (
              <Stack
                component="form"
                onSubmit={(e) => void handleTokenSubmit(e)}
                spacing={2}
                sx={{ width: '100%' }}
              >
                <TextField
                  label="Firebase Custom Token"
                  placeholder="Cole o JWT emitido pela API"
                  value={customToken}
                  onChange={(e) => setCustomToken(e.target.value)}
                  size="small"
                  fullWidth
                  multiline
                  minRows={2}
                />

                <Button
                  type="submit"
                  variant="contained"
                  fullWidth
                  disabled={carregando || !customToken.trim()}
                  startIcon={<Key />}
                  sx={{ py: 1.2, fontWeight: 700 }}
                >
                  Autenticar com Token
                </Button>

                {isDev && (
                  <>
                    <Divider>Ambiente Local (DEV)</Divider>
                    <Stack direction="row" spacing={1}>
                      <TextField
                        size="small"
                        label="UID de teste"
                        value={uidDev}
                        onChange={(e) => setUidDev(e.target.value)}
                        fullWidth
                      />
                      <Button
                        variant="outlined"
                        disabled={carregando || !uidDev.trim()}
                        onClick={() => void handleGerarTokenDev()}
                        sx={{ whiteSpace: 'nowrap' }}
                      >
                        Entrar rápido
                      </Button>
                    </Stack>
                  </>
                )}
              </Stack>
            )}
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
