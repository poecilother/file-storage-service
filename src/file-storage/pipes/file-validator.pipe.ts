import {
  ArgumentMetadata,
  HttpStatus,
  Injectable,
  ParseFilePipeBuilder,
  PipeTransform,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import { EnvVariable } from '../../config/env/env-variable.constants'
import { FileExtensionValidator } from '../validators/file-extension.validator'

@Injectable()
export class FileValidatorPipe implements PipeTransform {
  private readonly pipe: PipeTransform

  constructor(configService: ConfigService) {
    const allowedExtensions = configService
      .getOrThrow<string>(EnvVariable.FILE_ALLOWED_EXTENSIONS)
      .split(',')
      .map((extension) => extension.trim().toLowerCase())

    this.pipe = new ParseFilePipeBuilder()
      .addMaxSizeValidator({
        maxSize: configService.getOrThrow<number>(EnvVariable.FILE_MAX_SIZE),
      })
      .addValidator(new FileExtensionValidator({ allowedExtensions }))
      .build({ errorHttpStatusCode: HttpStatus.BAD_REQUEST })
  }

  transform(value: Express.Multer.File, metadata: ArgumentMetadata) {
    return this.pipe.transform(value, metadata)
  }
}
