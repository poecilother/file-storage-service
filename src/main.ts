import { Logger, ValidationPipe } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'

import { AppModule } from './app.module'
import {
  EnvVariable,
  EnvVariableDefault,
} from './config/env/env-variable.constants'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))

  const configService = app.get(ConfigService)
  const port = configService.get<number>(
    EnvVariable.PORT,
    EnvVariableDefault[EnvVariable.PORT],
  )

  await app.listen(port, () => {
    Logger.log(`Server listening on http://localhost:${port}`)
  })
}
bootstrap()
