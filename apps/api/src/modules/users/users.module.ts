import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import {
  PermissionEntity,
  RoleEntity,
  RolePermissionEntity,
  UserEntity,
} from './entities/user.entities';
import { SecurityController } from './security.controller';
import { SecurityService } from './security.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserEntity,
      RoleEntity,
      PermissionEntity,
      RolePermissionEntity,
    ]),
  ],
  controllers: [SecurityController],
  providers: [SecurityService],
  exports: [TypeOrmModule, SecurityService],
})
export class UsersModule {}
