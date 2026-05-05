import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigRegistryService } from '../config-registry/config-registry.service';
import { AskQuestionResponseDto } from './dtos/ask-question-response.dto';

const BASE_URL = 'https://lokte.vaimo.network';

interface LokteSessionResponse {
  id?: string;
  chat_session_id?: string;
}

interface LokteNdjsonChunk {
  type?: string;
  answer_piece?: string;
  error?: string;
}

@Injectable()
export class LokteService {
  private readonly logger = new Logger(LokteService.name);

  constructor(private readonly configRegistry: ConfigRegistryService) {}

  async ask(shopId: string, message: string): Promise<AskQuestionResponseDto> {
    const enabled = await this.configRegistry.get(shopId, 'lokte.connection.enabled');
    if (!enabled) {
      throw new BadRequestException('Lokte integration is not enabled for this shop');
    }

    const apiKey = await this.configRegistry.get(shopId, 'lokte.connection.api_key');
    if (!apiKey || apiKey === '') {
      throw new BadRequestException('Lokte API key is not configured for this shop');
    }

    const personaId = await this.configRegistry.get(shopId, 'lokte.connection.persona_id');

    const sessionId = await this.createChatSession(String(apiKey), String(personaId));
    const answer = await this.sendMessage(String(apiKey), sessionId, message);

    return { answer };
  }

  private async createChatSession(apiKey: string, personaId: string): Promise<string> {
    let response: Response;
    try {
      response = await fetch(`${BASE_URL}/api/chat/create-chat-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ persona_id: personaId }),
      });
    } catch (err) {
      throw new BadGatewayException(`Lokte API unreachable: ${(err as Error).message}`);
    }

    if (!response.ok) {
      throw new BadGatewayException(`Lokte create-session failed: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as LokteSessionResponse;
    const sessionId = data.id ?? data.chat_session_id;
    if (!sessionId) {
      throw new BadGatewayException('Lokte API returned no session ID');
    }
    return sessionId;
  }

  private async sendMessage(apiKey: string, sessionId: string, message: string): Promise<string> {
    const payload = {
      chat_session_id: sessionId,
      parent_message_id: null,
      message,
      file_descriptors: [],
      prompt_id: 0,
      search_doc_ids: null,
      retrieval_options: {
        run_search: 'auto',
        real_time: true,
        filters: {
          source_type: null,
          document_set: null,
          time_cutoff: null,
          tags: [],
        },
      },
      query_override: null,
    };

    let response: Response;
    try {
      response = await fetch(`${BASE_URL}/api/chat/send-message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      throw new BadGatewayException(`Lokte API unreachable: ${(err as Error).message}`);
    }

    if (!response.ok) {
      throw new BadGatewayException(`Lokte send-message failed: ${response.status} ${response.statusText}`);
    }

    const text = await response.text();
    return this.parseNdjsonAnswer(text);
  }

  /** Parse NDJSON stream, collect all answer_piece chunks, return joined answer. */
  private parseNdjsonAnswer(ndjson: string): string {
    const lines = ndjson.split('\n').filter((l) => l.trim().length > 0);
    const pieces: string[] = [];

    for (const line of lines) {
      try {
        const chunk = JSON.parse(line) as LokteNdjsonChunk;
        if (chunk.type === 'answer' && chunk.answer_piece) {
          pieces.push(chunk.answer_piece);
        }
        if (chunk.error) {
          this.logger.warn(`Lokte returned error chunk: ${chunk.error}`);
          throw new BadGatewayException(`Lokte error: ${chunk.error}`);
        }
      } catch (e) {
        if (e instanceof BadGatewayException) throw e;
        // Non-JSON lines are ignored (e.g. empty keep-alive lines)
      }
    }

    return pieces.join('');
  }
}
