import { Global, Module } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { UsuariosModule } from '../usuarios/usuarios.module.js';
import { FirebaseAuthGuard } from './firebase-auth/firebase-auth.guard.js';

@Global()
@Module({
  imports: [UsuariosModule],
  providers: [AuthService, FirebaseAuthGuard],
  exports: [AuthService, FirebaseAuthGuard, UsuariosModule],
})
export class AuthModule { }
