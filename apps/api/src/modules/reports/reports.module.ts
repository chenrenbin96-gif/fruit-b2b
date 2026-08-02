import { Module } from '@nestjs/common';import { ReportsController } from './reports.controller';import { ReportsService } from './reports.service';import { BiController } from './bi.controller';import { BiService } from './bi.service';
@Module({controllers:[ReportsController,BiController],providers:[ReportsService,BiService]}) export class ReportsModule{}
