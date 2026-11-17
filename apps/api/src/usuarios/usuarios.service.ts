import { Injectable, NotFoundException } from '@nestjs/common';
import { UpdateUsuarioDto } from './dto/update-usuario.dto.js';
import { InjectRepository } from '@nestjs/typeorm';
import { Usuario } from './entities/usuario.entity.js';
import { Repository } from 'typeorm';
import { DecodedIdToken } from 'firebase-admin/auth';

@Injectable()
export class UsuariosService {
  constructor(@InjectRepository(Usuario) private readonly usuarioRepo: Repository<Usuario>,) {
  }

  async findOrCreateFromFirebase(decodedToken: DecodedIdToken): Promise<Usuario> {
    const { uid, email, name, firebase } = decodedToken;

    // Procura pelo firebase_uid
    let usuario = await this.usuarioRepo.findOne({
      where: { firebase_uid: uid },
    });

    if (usuario) {
      return usuario;
    }

    if (email) {
      usuario = await this.usuarioRepo.findOne({ where: { email } });
      if (usuario) {
        usuario.firebase_uid = uid;
        return this.usuarioRepo.save(usuario);
      }
    }

    // Extrai o google_id se o login tenha sido feito com o Google
    const googleIdentities = firebase?.identities?.['google.com'];
    const googleId =
      Array.isArray(googleIdentities) && googleIdentities.length > 0
        ? String(googleIdentities[0])
        : null;

    const emailPrefix = email ? email.split('@')[0] : null;
    const displayName = name || emailPrefix || 'Passageiro(a) Metrorec';

    // Cria o novo usuário no PostgresSQL
    const novoUsuario = this.usuarioRepo.create({
      firebase_uid: uid,
      google_id: googleId,
      email: email ?? `${uid}@sem-email.local`,
      nome: displayName,
    });

    return this.usuarioRepo.save(novoUsuario);
  }

  async findOne(id: string): Promise<Usuario> {
    const usuario = await this.usuarioRepo.findOne({ where: { id } });
    if (!usuario) {
      throw new NotFoundException('Usuário não encontrado');
    }
    return usuario;
  }

  async update(id: string, updateUsuarioDto: UpdateUsuarioDto): Promise<Usuario> {
    const usuario = await this.findOne(id);
    Object.assign(usuario, updateUsuarioDto);
    return this.usuarioRepo.save(usuario);
  }

  async remove(id: string): Promise<void> {
    const usuario = await this.findOne(id);
    await this.usuarioRepo.remove(usuario);
  }
}
