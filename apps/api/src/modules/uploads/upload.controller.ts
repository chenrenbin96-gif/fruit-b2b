import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import {
  Controller,
  Post,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';

import {
  RequirePermissions,
  RequirePrincipalTypes,
} from '../../common/decorators/auth.decorators';
import { UploadService } from './upload.service';

const tempDir = join(process.cwd(), 'uploads/tmp');
mkdirSync(tempDir, { recursive: true });
const uploadStorage = diskStorage({
  destination: tempDir,
  filename: (_request, file, callback) =>
    callback(null, `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`),
});

@Controller('admin/upload')
@RequirePrincipalTypes('EMPLOYEE')
@RequirePermissions('product.media.manage')
export class UploadController {
  constructor(private readonly uploads: UploadService) {}

  @Post('image')
  @UseInterceptors(FileInterceptor('file', {
    storage: uploadStorage,
    limits: { fileSize: 20 * 1024 * 1024, files: 1 },
  }))
  image(@UploadedFile() file?: Express.Multer.File) {
    return this.uploads.image(file);
  }

  @Post('images')
  @UseInterceptors(FilesInterceptor('files[]', 6, {
    storage: uploadStorage,
    limits: { fileSize: 20 * 1024 * 1024, files: 6 },
  }))
  images(@UploadedFiles() files?: Express.Multer.File[]) {
    return this.uploads.images(files);
  }

  @Post('video')
  @UseInterceptors(FileInterceptor('file', {
    storage: uploadStorage,
    limits: { fileSize: 500 * 1024 * 1024, files: 1 },
  }))
  video(@UploadedFile() file?: Express.Multer.File) {
    return this.uploads.video(file);
  }
}
