import { createReadStream } from 'node:fs';
import { mkdir, writeFile, copyFile } from 'node:fs/promises';
import { join } from 'node:path';

import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class StorageService {
  private readonly provider: 'LOCAL' | 'S3';
  private readonly uploadRoot: string;
  private readonly s3: S3Client | null;

  constructor(private readonly config: ConfigService) {
    this.provider = config.get<string>('STORAGE_PROVIDER', 'LOCAL') === 'S3'
      ? 'S3'
      : 'LOCAL';
    this.uploadRoot = config.get<string>('UPLOAD_DIR', join(process.cwd(), 'uploads'));
    this.s3 = this.provider === 'S3'
      ? new S3Client({
          region: config.get<string>('STORAGE_REGION', 'auto'),
          endpoint: config.getOrThrow<string>('STORAGE_ENDPOINT'),
          forcePathStyle: config.get<boolean>('STORAGE_FORCE_PATH_STYLE', true),
          credentials: {
            accessKeyId: config.getOrThrow<string>('STORAGE_ACCESS_KEY'),
            secretAccessKey: config.getOrThrow<string>('STORAGE_SECRET_KEY'),
          },
        })
      : null;
  }

  async putBuffer(key: string, body: Buffer, contentType: string) {
    if (this.provider === 'LOCAL') {
      const target = join(this.uploadRoot, key);
      await mkdir(join(target, '..'), { recursive: true });
      await writeFile(target, body);
      return `/uploads/${key}`;
    }
    await this.s3!.send(new PutObjectCommand({
      Bucket: this.config.getOrThrow<string>('STORAGE_BUCKET'),
      Key: key,
      Body: body,
      ContentType: contentType,
    }));
    return this.publicUrl(key);
  }

  async putFile(key: string, sourcePath: string, contentType: string) {
    if (this.provider === 'LOCAL') {
      const target = join(this.uploadRoot, key);
      await mkdir(join(target, '..'), { recursive: true });
      await copyFile(sourcePath, target);
      return `/uploads/${key}`;
    }
    await this.s3!.send(new PutObjectCommand({
      Bucket: this.config.getOrThrow<string>('STORAGE_BUCKET'),
      Key: key,
      Body: createReadStream(sourcePath),
      ContentType: contentType,
    }));
    return this.publicUrl(key);
  }

  private publicUrl(key: string) {
    const base = this.config.get<string>('STORAGE_PUBLIC_URL')
      ?? this.config.getOrThrow<string>('STORAGE_ENDPOINT');
    return `${base.replace(/\/$/, '')}/${key}`;
  }
}
