import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { ShopifySessionGuard } from '../auth/guards/shopify-session.guard';
import { LokteService } from './lokte.service';
import { AskQuestionDto } from './dtos/ask-question.dto';
import { AskQuestionResponseDto } from './dtos/ask-question-response.dto';

@Controller('question')
@UseGuards(ShopifySessionGuard)
export class LokteController {
  constructor(private readonly lokteService: LokteService) {}

  /**
   * POST /question
   * Sends a question to the Lokte AI and returns the answer.
   * Shop identity is taken from the validated session JWT (request.shopDomain).
   */
  @Post()
  @HttpCode(HttpStatus.OK)
  async ask(
    @Body() dto: AskQuestionDto,
    @Req() req: Request & { shopDomain: string },
  ): Promise<AskQuestionResponseDto> {
    return this.lokteService.ask(req.shopDomain, dto.message);
  }
}
