import { ForbiddenException } from "@nestjs/common";
import { makeUsuario } from "../../test/fixtures.js";
import { AuthController } from "./auth.controller.js";
import { AuthService } from "./auth.service.js";

describe('AuthController & AuthService', () => {
  let controller: AuthController;
  let authService: { createCustomToken: ReturnType<typeof vi.fn> };
  let reputacaoService: { getPeso: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    authService = {
      createCustomToken: vi.fn().mockResolvedValue('firebase-custom-token'),
    };
    reputacaoService = {
      getPeso: vi.fn().mockReturnValue(1.5),
    };
    controller = new AuthController(
      authService as unknown as AuthService,
      reputacaoService as any,
    );
  });

  describe('POST /auth/sync e GET /auth/me', () => {
    it('retorna o usuário sincronizado e seu peso de reputação', () => {
      const usuario = makeUsuario({ id: 'u-1', reputacao: 35 });

      const resSync = controller.sync(usuario);
      const resMe = controller.me(usuario);

      expect(reputacaoService.getPeso).toHaveBeenCalledWith(35);
      expect(resSync).toEqual({ usuario, peso: 1.5 });
      expect(resMe).toEqual({ usuario, peso: 1.5 });
    });
  });

  describe('POST /auth/custom-token', () => {
    const envOriginal = process.env.NODE_ENV;

    afterEach(() => {
      process.env.NODE_ENV = envOriginal;
    });

    it('gera custom_token fora de produção', async () => {
      process.env.NODE_ENV = 'development';

      const res = await controller.createCustomToken({ uid: 'uid-teste-123' });

      expect(authService.createCustomToken).toHaveBeenCalledWith('uid-teste-123');
      expect(res).toEqual({ custom_token: 'firebase-custom-token' });
    });

    it('bloqueia geração de custom_token em produção com 403', async () => {
      process.env.NODE_ENV = 'production';

      await expect(
        AuthService.prototype.createCustomToken.call({}, 'uid-teste-123'),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
