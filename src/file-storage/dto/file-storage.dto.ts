import { IsNotEmpty, IsString, MaxLength } from 'class-validator'

import { FileStorage } from '../../database/entities/file.entity'

export class FileStorageDto {
  id: string
  type: string
  storage: FileStorage
}

export class GetFileListQueryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  fileType: string
}

export class UploadFileBodyDto extends GetFileListQueryDto {}

export class UploadFileResponseDto {
  id: string
}
