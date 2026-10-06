import {
  forgotPasswordSchema,
  loginSchema,
  refreshSchema,
  registerSchema,
  resetPasswordSchema,
} from '@agrovax/shared';
import type { Request, Response } from 'express';
import { parse } from '../../lib/validate';
import { currentUserId } from '../../middleware/authenticate';
import type { AuthService } from './auth.service';

export class AuthController {
  constructor(private readonly auth: AuthService) {}

  register = async (req: Request, res: Response): Promise<void> => {
    res.status(201).json(await this.auth.register(parse(registerSchema, req.body)));
  };

  login = async (req: Request, res: Response): Promise<void> => {
    res.json(await this.auth.login(parse(loginSchema, req.body)));
  };

  refresh = async (req: Request, res: Response): Promise<void> => {
    const { refreshToken } = parse(refreshSchema, req.body);
    res.json(await this.auth.refresh(refreshToken));
  };

  logout = async (req: Request, res: Response): Promise<void> => {
    const { refreshToken } = parse(refreshSchema, req.body);
    await this.auth.logout(refreshToken);
    res.status(204).end();
  };

  forgotPassword = async (req: Request, res: Response): Promise<void> => {
    await this.auth.forgotPassword(parse(forgotPasswordSchema, req.body));
    res.status(202).json({
      message: 'Se o e-mail estiver cadastrado, enviaremos um código para redefinir a senha.',
    });
  };

  resetPassword = async (req: Request, res: Response): Promise<void> => {
    await this.auth.resetPassword(parse(resetPasswordSchema, req.body));
    res.status(204).end();
  };

  me = async (req: Request, res: Response): Promise<void> => {
    res.json(await this.auth.me(currentUserId(req)));
  };
}
