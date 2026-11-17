import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../auth.service.js';
import { UsuariosService } from '../../usuarios/usuarios.service.js';

@Injectable()
export class FirebaseAuthGuard implements CanActivate {
  constructor(
    private readonly authService: AuthService,
    private readonly usuariosService: UsuariosService,
  ) { }

  async canActivate(
    context: ExecutionContext,
  ): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith(`Bearer `)) {
      throw new UnauthorizedException("Token de autenticação ausente ou inválido");
    }

    const token = authHeader.split(' ')[1];
    const decodedToken = await this.authService.verifyToken(token);

    // Sincroniza com o PostgresSQL e anexa toda a entidade na requisição
    const usuario = await this.usuariosService.findOrCreateFromFirebase(decodedToken)
    request.user = usuario;

    return true;
  }
}
