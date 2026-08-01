import { execFile } from 'node:child_process';
import { readFile, rm } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';

import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import sharp from 'sharp';

import { StorageService } from './storage.service';

const execFileAsync = promisify(execFile);

@Injectable()
export class UploadService {
  constructor(
    private readonly storage: StorageService,
    private readonly config: ConfigService,
  ) {}

  async image(file?: Express.Multer.File, folder = 'products') {
    if (!file) this.invalidImage();
    try {
      const extension = extname(file.originalname).toLowerCase();
      if (
        !['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype) ||
        !['.jpg', '.jpeg', '.png', '.webp'].includes(extension)
      ) {
        this.invalidImage();
      }
      const source = await readFile(file.path);
      const id = randomUUID();
      const original = await sharp(source)
        .rotate()
        .resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 86 })
        .toBuffer();
      const thumbnail = await sharp(source)
        .rotate()
        .resize({ width: 480, height: 480, fit: 'cover' })
        .webp({ quality: 78 })
        .toBuffer();
      const url = await this.storage.putBuffer(
        `${folder}/${id}.webp`,
        original,
        'image/webp',
      );
      const thumbnailUrl = await this.storage.putBuffer(
        `${folder}/${id}-thumb.webp`,
        thumbnail,
        'image/webp',
      );
      return {
        url,
        thumbnail_url: thumbnailUrl,
        size: original.length,
        type: 'image/webp',
        duration: null,
      };
    } finally {
      await rm(file.path, { force: true });
    }
  }

  async images(files?: Express.Multer.File[]) {
    if (!files?.length) {
      throw new BadRequestException({
        code: 'IMAGE_FILES_REQUIRED',
        message: '请至少选择一张图片',
      });
    }
    if (files.length > 6) {
      await Promise.all(files.map((file) => rm(file.path, { force: true })));
      throw new BadRequestException({
        code: 'IMAGE_UPLOAD_LIMIT_EXCEEDED',
        message: '单次最多上传6张图片',
      });
    }
    return Promise.all(files.map((file) => this.image(file)));
  }

  async video(file?: Express.Multer.File, folder = 'products') {
    if (!file) this.invalidVideo();
    if (
      file.mimetype !== 'video/mp4' ||
      extname(file.originalname).toLowerCase() !== '.mp4'
    ) {
      await rm(file.path, { force: true });
      this.invalidVideo();
    }
    const id = randomUUID();
    const coverPath = join(
      this.config.get<string>('UPLOAD_TEMP_DIR', join(process.cwd(), 'uploads/tmp')),
      `${id}-cover.jpg`,
    );
    try {
      const [{ stdout }] = await Promise.all([
        execFileAsync('ffprobe', [
          '-v', 'error', '-show_entries', 'format=duration',
          '-of', 'default=noprint_wrappers=1:nokey=1', file.path,
        ]),
        execFileAsync('ffmpeg', [
          '-y', '-ss', '0', '-i', file.path,
          '-frames:v', '1', '-vf', 'scale=960:-2', coverPath,
        ]),
      ]);
      const duration = Number(stdout.trim());
      const url = await this.storage.putFile(
        `${folder}/${id}.mp4`,
        file.path,
        'video/mp4',
      );
      const cover = await sharp(await readFile(coverPath))
        .webp({ quality: 82 })
        .toBuffer();
      const thumbnailUrl = await this.storage.putBuffer(
        `${folder}/${id}-cover.webp`,
        cover,
        'image/webp',
      );
      return {
        url,
        thumbnail_url: thumbnailUrl,
        size: file.size,
        type: file.mimetype,
        duration: Number.isFinite(duration) ? Number(duration.toFixed(2)) : null,
      };
    } catch {
      throw new BadRequestException({
        code: 'VIDEO_PROCESSING_FAILED',
        message: '视频解析或封面生成失败',
      });
    } finally {
      await Promise.all([
        rm(file.path, { force: true }),
        rm(coverPath, { force: true }),
      ]);
    }
  }

  afterSaleImage(file?: Express.Multer.File) { return this.image(file, 'after-sales'); }
  afterSaleVideo(file?: Express.Multer.File) { return this.video(file, 'after-sales'); }

  private invalidImage(): never {
    throw new BadRequestException({
      code: 'INVALID_IMAGE_FILE',
      message: '仅支持JPG、JPEG、PNG、WebP图片',
    });
  }

  private invalidVideo(): never {
    throw new BadRequestException({
      code: 'INVALID_VIDEO_FILE',
      message: '仅支持MP4视频',
    });
  }
}
