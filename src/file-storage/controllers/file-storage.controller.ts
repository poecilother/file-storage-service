import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import {
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger'

import {
  FileStorageDto,
  GetFileListQueryDto,
  UploadFileBodyDto,
  UploadFileResponseDto,
} from '../dto/file-storage.dto'
import { FileValidatorPipe } from '../pipes/file-validator.pipe'
import { FileStorageService } from '../services/file-storage.service'

@ApiTags('file-storage')
@Controller('file-storage')
export class FileStorageController {
  constructor(private fileStorageService: FileStorageService) {}

  @ApiOperation({ summary: 'Download a file' })
  @ApiParam({ name: 'id', description: 'File id' })
  @ApiParam({ name: 'type', description: 'File type' })
  @Get('/:id/:type')
  async getFile(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('type') type: string,
  ): Promise<StreamableFile> {
    const { stream, fileEntity } = await this.fileStorageService.getFile(
      id,
      type,
    )

    return new StreamableFile(stream, {
      type: fileEntity.mimetype,
      disposition: `attachment; filename*=UTF-8''${encodeURIComponent(fileEntity.originalName)}`,
    })
  }

  @ApiOperation({ summary: 'Get the storage tier of a file' })
  @ApiParam({ name: 'id', description: 'File id' })
  @ApiParam({ name: 'type', description: 'File type' })
  @ApiOkResponse({ type: FileStorageDto })
  @Get('/storage/:id/:type')
  async getFileStorage(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('type') type: string,
  ): Promise<FileStorageDto> {
    return this.fileStorageService.getFileStorage(id, type)
  }

  @ApiOperation({ summary: 'List file ids by type' })
  @ApiOkResponse({ type: String, isArray: true })
  @Get('/list')
  async listFiles(
    @Query() { fileType }: GetFileListQueryDto,
  ): Promise<string[]> {
    return this.fileStorageService.getFileListByType(fileType)
  }

  @ApiOperation({ summary: 'Upload a file' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        fileType: { type: 'string' },
      },
      required: ['file', 'fileType'],
    },
  })
  @ApiOkResponse({ type: UploadFileResponseDto })
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

  @ApiOperation({ summary: 'Delete a file' })
  @ApiParam({ name: 'id', description: 'File id' })
  @ApiParam({ name: 'type', description: 'File type' })
  @Delete('/:id/:type')
  async deleteFile(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('type') type: string,
  ): Promise<void> {
    await this.fileStorageService.deleteFile(id, type)
  }
}
