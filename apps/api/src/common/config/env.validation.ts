const VARIAVEIS_OBRIGATORIAS_PRODUCAO = [
  'DB_HOST',
  'DB_PORT',
  'DB_USER',
  'DB_PASSWORD',
  'DB_NAME',
  'CORS_ORIGINS',
  'FIREBASE_PROJECT_ID',
  'FIREBASE_CLIENT_EMAIL',
  'FIREBASE_PRIVATE_KEY',
] as const;

export function validarAmbienteProducao(
  env: NodeJS.ProcessEnv = process.env,
): void {
  if (env.NODE_ENV !== 'production') {
    return;
  }

  const ausentes = VARIAVEIS_OBRIGATORIAS_PRODUCAO.filter((chave) => {
    const valor = env[chave];
    return !valor || valor.trim().length === 0;
  });

  if (ausentes.length > 0) {
    throw new Error(
      `Variáveis de ambiente obrigatórias ausentes em produção: ${ausentes.join(', ')}`,
    );
  }

  const porta = Number(env.DB_PORT);
  if (!Number.isInteger(porta) || porta <= 0 || porta > 65535) {
    throw new Error(`DB_PORT inválido em produção: "${env.DB_PORT}"`);
  }

  if (env.TYPEORM_SYNCHRONIZE === 'true') {
    throw new Error(
      'TYPEORM_SYNCHRONIZE=true não é permitido quando NODE_ENV=production',
    );
  }
}
