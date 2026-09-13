import {
  Body,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'

import {
  UploadFileBodyDto,
  UploadFileResponseDto,
} from '../dto/upload-file.dto'
import { FileValidatorPipe } from '../pipes/file-validator.pipe'
import { FileStorageService } from '../services/file-storage.service'

@Controller('file-storage')
export class FileStorageController {
  constructor(private fileStorageService: FileStorageService) {}

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
