import { Global, Module } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { UsuariosModule } from '../usuarios/usuarios.module.js';
import { FirebaseAuthGuard } from './firebase-auth/firebase-auth.guard.js';
import { AuthController } from './auth.controller.js';

@Global()
@Module({
  imports: [UsuariosModule],
  exports: [AuthService, FirebaseAuthGuard, UsuariosModule],
  controllers: [AuthController],
  providers: [AuthService, FirebaseAuthGuard],
})
export class AuthModule { }
