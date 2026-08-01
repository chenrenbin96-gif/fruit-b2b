import { Module } from '@nestjs/common';

import { StorageService } from './storage.service';
import { UploadController } from './upload.controller';
import { UploadService } from './upload.service';
import { CustomerAfterSaleUploadController } from './customer-after-sale-upload.controller';

@Module({
  controllers: [UploadController, CustomerAfterSaleUploadController],
  providers: [StorageService, UploadService],
  exports: [StorageService],
})
export class UploadsModule {}
