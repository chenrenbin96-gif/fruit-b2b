import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { Controller, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { RequirePrincipalTypes } from '../../common/decorators/auth.decorators';
import { UploadService } from './upload.service';

const tempDir = join(process.cwd(), 'uploads/tmp');
mkdirSync(tempDir, { recursive: true });
const storage = diskStorage({ destination: tempDir, filename: (_r, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`) });

@Controller('customer/upload/after-sale')
@RequirePrincipalTypes('CUSTOMER_ACCOUNT')
export class CustomerAfterSaleUploadController {
  constructor(private readonly uploads: UploadService) {}
  @Post('image') @UseInterceptors(FileInterceptor('file', { storage, limits: { fileSize: 20 * 1024 * 1024, files: 1 } })) image(@UploadedFile() file?: Express.Multer.File) { return this.uploads.afterSaleImage(file); }
  @Post('video') @UseInterceptors(FileInterceptor('file', { storage, limits: { fileSize: 500 * 1024 * 1024, files: 1 } })) video(@UploadedFile() file?: Express.Multer.File) { return this.uploads.afterSaleVideo(file); }
}
