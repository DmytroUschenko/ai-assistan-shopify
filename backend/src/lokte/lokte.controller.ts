import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ShopifySessionGuard } from '../auth/guards/shopify-session.guard';
import { LokteService, SourceDocument } from './lokte.service';
import { AskQuestionDto } from './dtos/ask-question.dto';
import { ChatMessage } from './entities/chat-message.entity';

@Controller('lokte')
@UseGuards(ShopifySessionGuard)
export class LokteController {
  constructor(private readonly lokteService: LokteService) {}

  /** GET /lokte/:shopId/history?userId=xxx */
  @Get(':shopId/history')
  getHistory(
    @Param('shopId') shopId: string,
    @Query('userId') userId: string,
  ): Promise<ChatMessage[]> {
    return this.lokteService.getHistory(shopId, userId || 'default');
  }

  /** DELETE /lokte/:shopId/history?userId=xxx */
  @Delete(':shopId/history')
  @HttpCode(HttpStatus.OK)
  async clearHistory(
    @Param('shopId') shopId: string,
    @Query('userId') userId: string,
  ): Promise<{ cleared: boolean }> {
    await this.lokteService.clearHistory(shopId, userId || 'default');
    return { cleared: true };
  }

  /** POST /lokte/:shopId/question */
  @Post(':shopId/question')
  @HttpCode(HttpStatus.OK)
  async askQuestion(
    @Param('shopId') shopId: string,
    @Body() dto: AskQuestionDto,
  ): Promise<{ answer: string; documents: SourceDocument[] }> {
    return this.lokteService.askQuestion(shopId, dto.userId ?? 'default', dto.question);
  }
}
