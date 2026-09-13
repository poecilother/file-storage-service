import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'

import {
  FileStorageDto,
  GetFileListQueryDto,
  UploadFileBodyDto,
  UploadFileResponseDto,
} from '../dto/file-storage.dto'
import { FileValidatorPipe } from '../pipes/file-validator.pipe'
import { FileStorageService } from '../services/file-storage.service'

@Controller('file-storage')
export class FileStorageController {
  constructor(private fileStorageService: FileStorageService) {}

  @Get('/:id/:type')
  async getFileStorage(
    @Param('id') id: string,
    @Param('type') type: string,
  ): Promise<FileStorageDto> {
    return this.fileStorageService.getFileStorage(id, type)
  }

  @Get('/list')
  async listFiles(
    @Query() { fileType }: GetFileListQueryDto,
  ): Promise<string[]> {
    return this.fileStorageService.getFileListByType(fileType)
  }

  @Post('/')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile(FileValidatorPipe)
    file: Express.Multer.File,
    @Body() { fileType }: UploadFileBodyDto,
  ): Promise<UploadFileResponseDto> {
    const id = await this.fileStorageService.saveFile(file, fileType)

    return { id }
  }
}
