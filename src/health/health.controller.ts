import { Controller, Get } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

import { HealthService } from './health.service'

@ApiTags('health')
@Controller('/health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  getHello(): string {
    return this.healthService.getHello()
  }
}
