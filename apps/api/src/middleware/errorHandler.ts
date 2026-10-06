import type { ApiErrorBody } from '@agrovax/shared';
import type { ErrorRequestHandler, RequestHandler } from 'express';
import { AppError } from '../lib/errors';
import { logger } from '../lib/logger';

export const notFoundHandler: RequestHandler = (_req, res) => {
  const body: ApiErrorBody = { error: { code: 'NOT_FOUND', message: 'Rota não encontrada.' } };
  res.status(404).json(body);
};

function isBodyParseError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'type' in error &&
    (error.type === 'entity.parse.failed' || error.type === 'entity.too.large')
  );
}

/** Converte qualquer erro em resposta JSON padronizada, sem vazar detalhes internos. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  if (error instanceof AppError) {
    const body: ApiErrorBody = {
      error: { code: error.code, message: error.message, ...(error.fields ? { fields: error.fields } : {}) },
    };
    res.status(error.status).json(body);
    return;
  }

  if (isBodyParseError(error)) {
    const body: ApiErrorBody = {
      error: { code: 'INVALID_BODY', message: 'Corpo da requisição inválido.' },
    };
    res.status(400).json(body);
    return;
  }

  logger.error({ err: error, method: req.method, path: req.path }, 'erro nao tratado');
  const body: ApiErrorBody = {
    error: { code: 'INTERNAL_ERROR', message: 'Erro interno. Tente novamente em instantes.' },
  };
  res.status(500).json(body);
};
