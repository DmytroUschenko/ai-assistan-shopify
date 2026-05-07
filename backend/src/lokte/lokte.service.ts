import {
  BadGatewayException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigRegistryService } from '../config-registry/config-registry.service';

const LOKTE_BASE_URL = 'https://lokte.vaimo.network';

interface CreateSessionResponse {
  id?: string;
  chat_session_id?: string;
}

@Injectable()
export class LokteService {
  private readonly logger = new Logger(LokteService.name);

  constructor(private readonly configRegistry: ConfigRegistryService) {}

  async askQuestion(shopId: string, question: string): Promise<string> {
    await this.assertConfigured(shopId);

    const token = await this.configRegistry.getDecrypted(shopId, 'lokte.general.api_key');
    const personaId = String(await this.configRegistry.get(shopId, 'lokte.general.user_id') ?? '');

    const sessionId = await this.createChatSession(token, personaId);
    return this.sendMessage(token, sessionId, question);
  }

  private async assertConfigured(shopId: string): Promise<void> {
    const enabled = await this.configRegistry.get(shopId, 'lokte.general.enable');
    if (!enabled) {
      throw new ServiceUnavailableException('wrong lokte connection');
    }

    const apiKey = await this.configRegistry.getDecrypted(shopId, 'lokte.general.api_key');
    if (!apiKey) {
      throw new ServiceUnavailableException('wrong lokte connection');
    }

    const userId = await this.configRegistry.get(shopId, 'lokte.general.user_id');
    if (!userId) {
      throw new ServiceUnavailableException('wrong lokte connection');
    }
  }

  private async createChatSession(token: string, personaId: string): Promise<string> {
    let response: Response;
    try {
      response = await fetch(`${LOKTE_BASE_URL}/api/chat/create-chat-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ persona_id: personaId }),
      });
    } catch (err) {
      this.logger.error('Lokte create-chat-session network error', err);
      throw new BadGatewayException('Failed to reach Lokte API');
    }

    if (!response.ok) {
      this.logger.error(`Lokte create-chat-session failed: ${response.status}`);
      throw new BadGatewayException(`Lokte API error: ${response.status}`);
    }

    const data = (await response.json()) as CreateSessionResponse;
    const sessionId = data.id ?? data.chat_session_id;

    if (!sessionId) {
      this.logger.error('Lokte create-chat-session returned no session id', data);
      throw new BadGatewayException('Lokte API did not return a session id');
    }

    return String(sessionId);
  }

  private async sendMessage(token: string, sessionId: string, question: string): Promise<string> {
    const payload = {
      chat_session_id: sessionId,
      parent_message_id: null,
      message: question,
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
      response = await fetch(`${LOKTE_BASE_URL}/api/chat/send-message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      this.logger.error('Lokte send-message network error', err);
      throw new BadGatewayException('Failed to reach Lokte API');
    }

    if (!response.ok) {
      this.logger.error(`Lokte send-message failed: ${response.status}`);
      throw new BadGatewayException(`Lokte API error: ${response.status}`);
    }

    // API streams NDJSON: one JSON object per line
    const text = await response.text();
    const pieces: string[] = [];

    for (const line of text.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(trimmed) as Record<string, unknown>;
      } catch {
        continue;
      }
      const obj = parsed.obj as { type?: string; content?: string } | undefined;
      if (obj?.type === 'message_delta' && typeof obj.content === 'string') {
        pieces.push(obj.content);
      }
    }

    const answer = pieces.join('');
    if (!answer) {
      this.logger.warn('Lokte send-message returned no message_delta content', text.slice(0, 500));
    }
    return answer;
  }
}
