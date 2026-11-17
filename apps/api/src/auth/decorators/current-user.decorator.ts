import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { Usuario } from "../../usuarios/entities/usuario.entity.js";

export const CurrentUser = createParamDecorator(
  (data: keyof Usuario | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user: Usuario = request.user;

    if (!user) {
      return null;
    }

    // Permite usar tanto  o @CurrentUser() como o @CurrentUser('id')
    return data ? user[data] : user;
  },
);
