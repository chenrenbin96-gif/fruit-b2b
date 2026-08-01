import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'roles' })
@Index(['tenantId', 'roleCode'], { unique: true })
export class RoleEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string;

  @Column({ name: 'tenant_id', type: 'bigint', unsigned: true })
  tenantId!: string;

  @Column({ name: 'role_name', type: 'varchar', length: 50 })
  roleName!: string;

  @Column({ name: 'role_code', type: 'varchar', length: 50 })
  roleCode!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description!: string | null;

  @Column({ name: 'is_system', type: 'boolean', default: false })
  isSystem!: boolean;

  @Column({ type: 'varchar', length: 20, default: 'ACTIVE' })
  status!: string;

  @OneToMany(() => RolePermissionEntity, (relation) => relation.role)
  rolePermissions!: RolePermissionEntity[];

  @OneToMany(() => UserEntity, (user) => user.role)
  users!: UserEntity[];

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 })
  updatedAt!: Date;

  @DeleteDateColumn({
    name: 'deleted_at',
    type: 'datetime',
    precision: 3,
    nullable: true,
  })
  deletedAt!: Date | null;
}

@Entity({ name: 'permissions' })
export class PermissionEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string;

  @Column({ name: 'permission_name', type: 'varchar', length: 100 })
  permissionName!: string;

  @Index({ unique: true })
  @Column({ name: 'permission_code', type: 'varchar', length: 100 })
  permissionCode!: string;

  @Column({ name: 'module_code', type: 'varchar', length: 50 })
  moduleCode!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description!: string | null;

  @Column({ type: 'varchar', length: 20, default: 'ACTIVE' })
  status!: string;

  @OneToMany(() => RolePermissionEntity, (relation) => relation.permission)
  rolePermissions!: RolePermissionEntity[];

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 })
  updatedAt!: Date;
}

@Entity({ name: 'role_permissions' })
@Index(['tenantId', 'roleId', 'permissionId'], { unique: true })
export class RolePermissionEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string;

  @Column({ name: 'tenant_id', type: 'bigint', unsigned: true })
  tenantId!: string;

  @Column({ name: 'role_id', type: 'bigint', unsigned: true })
  roleId!: string;

  @Column({ name: 'permission_id', type: 'bigint', unsigned: true })
  permissionId!: string;

  @ManyToOne(() => RoleEntity, (role) => role.rolePermissions)
  @JoinColumn({ name: 'role_id' })
  role!: RoleEntity;

  @ManyToOne(
    () => PermissionEntity,
    (permission) => permission.rolePermissions,
  )
  @JoinColumn({ name: 'permission_id' })
  permission!: PermissionEntity;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt!: Date;
}

@Entity({ name: 'users' })
@Index(['tenantId', 'username'], { unique: true })
export class UserEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string;

  @Column({ name: 'tenant_id', type: 'bigint', unsigned: true })
  tenantId!: string;

  @Column({ type: 'varchar', length: 64 })
  username!: string;

  @Column({ name: 'password_hash', type: 'varchar', length: 255 })
  passwordHash!: string;

  @Column({ type: 'varchar', length: 50 })
  name!: string;

  @Column({ type: 'varchar', length: 30, nullable: true })
  phone!: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  avatar!: string | null;

  @Column({ name: 'role_id', type: 'bigint', unsigned: true })
  roleId!: string;

  @Column({
    name: 'store_id',
    type: 'bigint',
    unsigned: true,
    nullable: true,
  })
  storeId!: string | null;

  @Column({
    name: 'warehouse_id',
    type: 'bigint',
    unsigned: true,
    nullable: true,
  })
  warehouseId!: string | null;

  @Column({ type: 'varchar', length: 20, default: 'ACTIVE' })
  status!: string;

  @Column({
    name: 'last_login_at',
    type: 'datetime',
    precision: 3,
    nullable: true,
  })
  lastLoginAt!: Date | null;

  @ManyToOne(() => RoleEntity, (role) => role.users)
  @JoinColumn({ name: 'role_id' })
  role!: RoleEntity;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 })
  updatedAt!: Date;

  @DeleteDateColumn({
    name: 'deleted_at',
    type: 'datetime',
    precision: 3,
    nullable: true,
  })
  deletedAt!: Date | null;
}
