/**
 * Erro de aplicacao com status HTTP, codigo estavel e mensagem para o usuario.
 * Qualquer outro erro e tratado como falha interna (500) pelo errorHandler.
 */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly fields?: Record<string, string>,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const errors = {
  validation: (fields: Record<string, string>) =>
    new AppError(400, 'VALIDATION_ERROR', 'Verifique os dados informados.', fields),
  unauthorized: (message = 'Sessão inválida ou expirada. Entre novamente.') =>
    new AppError(401, 'UNAUTHORIZED', message),
  invalidCredentials: () =>
    new AppError(401, 'INVALID_CREDENTIALS', 'E-mail ou senha incorretos.'),
  forbidden: (message = 'Você não tem permissão para esta ação.') =>
    new AppError(403, 'FORBIDDEN', message),
  notFound: (message = 'Registro não encontrado.') => new AppError(404, 'NOT_FOUND', message),
  conflict: (code: string, message: string) => new AppError(409, code, message),
  tooManyRequests: () =>
    new AppError(429, 'TOO_MANY_REQUESTS', 'Muitas tentativas. Aguarde alguns minutos e tente de novo.'),
};
