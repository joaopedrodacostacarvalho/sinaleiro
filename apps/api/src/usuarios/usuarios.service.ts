import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DecodedIdToken } from "firebase-admin/auth";
import { Repository } from "typeorm";
import { UpdateMeDto } from "./dto/update-me.dto.js";
import { Usuario } from "./entities/usuario.entity.js";

@Injectable()
export class UsuariosService {
  constructor(
    @InjectRepository(Usuario)
    private readonly usuarioRepo: Repository<Usuario>,
  ) { }

  /**
   * Chamado pelo FirebaseAuthGuard em toda requisição autenticada.
   * Garante que o usuário do Firebase exista no PostgreSQL e devolve
   * a entidade completa (usada como `request.user`).
   */
  async findOrCreateFromFirebase(decodedToken: DecodedIdToken): Promise<Usuario> {
    const { uid, email, name, firebase } = decodedToken;

    // Busca pelo firebase_uid (caminho mais comum)
    let usuario = await this.usuarioRepo.findOne({
      where: { firebase_uid: uid },
    });

    if (usuario) {
      return usuario;
    }

    // Fallback: e-mail já cadastrado em outro provedor — vincula o uid
    if (email) {
      usuario = await this.usuarioRepo.findOne({ where: { email } });
      if (usuario) {
        usuario.firebase_uid = uid;
        return this.usuarioRepo.save(usuario);
      }
    }

    // Extrai o google_id, se o login foi via Google
    const googleIdentities = firebase?.identities?.['google.com'];
    const googleId =
      Array.isArray(googleIdentities) && googleIdentities.length > 0
        ? String(googleIdentities[0])
        : null;

    const emailPrefix = email ? email.split('@')[0] : null;
    const displayName = name || emailPrefix || 'Passageiro(a) Metrorec';

    // Cria o usuário no PostgreSQL
    const novoUsuario = this.usuarioRepo.create({
      firebase_uid: uid,
      google_id: googleId,
      email: email ?? `${uid}@sem-email.local`,
      nome: displayName,
    });

    return this.usuarioRepo.save(novoUsuario);
  }

  /**
   * Busca um usuário por ID. Lança 404 se não existir.
   * Usado por `GET /usuarios/:id` e internamente por `updateMe`/`remove`.
   */
  async findOne(id: string): Promise<Usuario> {
    const usuario = await this.usuarioRepo.findOne({ where: { id } });
    if (!usuario) {
      throw new NotFoundException('Usuário não encontrado');
    }
    return usuario;
  }

  /**
   * Atualiza o próprio perfil do usuário autenticado.
   * O `id` vem SEMPRE do `@CurrentUser()` (extraído do token pelo guard),
   * nunca do body ou da URL — impede edição de terceiros.
   *
   * Atribuição explícita (em vez de `Object.assign`) para que qualquer
   * novo campo no `UpdateMeDto` exija uma linha de código aqui, forçando
   * revisão e evitando mass assignment acidental.
   */
  async updateMe(id: string, updateMeDto: UpdateMeDto): Promise<Usuario> {
    const usuario = await this.findOne(id);

    if (updateMeDto.nome !== undefined) {
      usuario.nome = updateMeDto.nome;
    }

    return this.usuarioRepo.save(usuario);
  }

  /**
   * Remove o usuário e seus dados (LGPD).
   * As FKs com `ON DELETE CASCADE` nos reportes/confirmações limpam
   * o restante automaticamente.
   */
  async remove(id: string): Promise<void> {
    const usuario = await this.findOne(id);
    await this.usuarioRepo.remove(usuario);
  }
}
