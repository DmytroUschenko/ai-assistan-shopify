import {
  BadGatewayException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigRegistryService } from '../config-registry/config-registry.service';
import { ChatMessage } from './entities/chat-message.entity';
import { ChatSession } from './entities/chat-session.entity';

const LOKTE_BASE_URL = 'https://lokte.vaimo.network';
const HISTORY_LIMIT = 100; // rows kept in DB per user
const CONTEXT_LIMIT = 20;  // messages sent to Lokte per request

interface CreateSessionResponse {
  id?: string;
  chat_session_id?: string;
}

export interface SourceDocument {
  title: string;
  link: string;
  source_type: string;
  blurb: string;
  updated_at: string | null;
}

export interface AskQuestionResult {
  answer: string;
  documents: SourceDocument[];
}

@Injectable()
export class LokteService {
  private readonly logger = new Logger(LokteService.name);

  constructor(
    private readonly configRegistry: ConfigRegistryService,
    @InjectRepository(ChatMessage)
    private readonly messageRepo: Repository<ChatMessage>,
    @InjectRepository(ChatSession)
    private readonly sessionRepo: Repository<ChatSession>,
  ) {}

  async askQuestion(shopId: string, userId: string, question: string): Promise<AskQuestionResult> {
    await this.assertConfigured(shopId);

    const token = await this.configRegistry.getDecrypted(shopId, 'lokte.general.api_key');
    const personaId = String(await this.configRegistry.get(shopId, 'lokte.general.user_id') ?? '');

    const session = await this.getOrCreateSession(shopId, userId, token, personaId);
    const result = await this.sendMessage(token, session.lokteSessionId, session.lastAssistantMsgId, question);

    await this.sessionRepo.update(session.id, { lastAssistantMsgId: result.reservedAssistantMsgId });
    await this.persistMessages(shopId, userId, question, result.answer);

    return { answer: result.answer, documents: result.documents };
  }

  async getHistory(shopId: string, userId: string): Promise<ChatMessage[]> {
    return this.messageRepo.find({
      where: { shopId, userId },
      order: { createdAt: 'ASC' },
      take: HISTORY_LIMIT,
    });
  }

  async clearHistory(shopId: string, userId: string): Promise<void> {
    const session = await this.sessionRepo.findOne({ where: { shopId, userId } });

    if (session) {
      const token = await this.configRegistry.getDecrypted(shopId, 'lokte.general.api_key');
      await this.deleteLokteSession(token, session.lokteSessionId);
      await this.sessionRepo.delete(session.id);
    }

    await this.messageRepo.delete({ shopId, userId });
  }

  // ── Private ──────────────────────────────────────────────────────────────────

  private async assertConfigured(shopId: string): Promise<void> {
    const enabled = await this.configRegistry.get(shopId, 'lokte.general.enable');
    if (!enabled) throw new ServiceUnavailableException('wrong lokte connection');

    const apiKey = await this.configRegistry.getDecrypted(shopId, 'lokte.general.api_key');
    if (!apiKey) throw new ServiceUnavailableException('wrong lokte connection');

    const userId = await this.configRegistry.get(shopId, 'lokte.general.user_id');
    if (!userId) throw new ServiceUnavailableException('wrong lokte connection');
  }

  private async getOrCreateSession(
    shopId: string,
    userId: string,
    token: string,
    personaId: string,
  ): Promise<ChatSession> {
    const existing = await this.sessionRepo.findOne({ where: { shopId, userId } });
    if (existing) return existing;

    const lokteSessionId = await this.createLokteSession(token, personaId);
    return this.sessionRepo.save(
      this.sessionRepo.create({ shopId, userId, lokteSessionId, lastAssistantMsgId: null }),
    );
  }

  private async createLokteSession(token: string, personaId: string): Promise<string> {
    let response: Response;
    try {
      response = await fetch(`${LOKTE_BASE_URL}/api/chat/create-chat-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
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
    if (!sessionId) throw new BadGatewayException('Lokte API did not return a session id');
    return String(sessionId);
  }

  private async sendMessage(
    token: string,
    lokteSessionId: string,
    parentMessageId: number | null,
    question: string,
  ): Promise<AskQuestionResult & { reservedAssistantMsgId: number | null }> {
    let response: Response;
    try {
      response = await fetch(`${LOKTE_BASE_URL}/api/chat/send-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          chat_session_id: lokteSessionId,
          parent_message_id: parentMessageId,
          message: question,
          file_descriptors: [],
          prompt_id: 0,
          search_doc_ids: null,
          retrieval_options: {
            run_search: 'auto',
            real_time: true,
            filters: { source_type: null, document_set: null, time_cutoff: null, tags: [] },
          },
          query_override: null,
        }),
      });
    } catch (err) {
      this.logger.error('Lokte send-message network error', err);
      throw new BadGatewayException('Failed to reach Lokte API');
    }

    if (!response.ok) {
      // Session may have expired — caller can retry with a fresh session
      this.logger.error(`Lokte send-message failed: ${response.status}`);
      throw new BadGatewayException(`Lokte API error: ${response.status}`);
    }

    const text = await response.text();
    const pieces: string[] = [];
    const documents: SourceDocument[] = [];
    let reservedAssistantMsgId: number | null = null;

    for (const line of text.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      let parsed: Record<string, unknown>;
      try { parsed = JSON.parse(trimmed) as Record<string, unknown>; } catch { continue; }

      // First NDJSON line carries message IDs
      if (typeof parsed.reserved_assistant_message_id === 'number') {
        reservedAssistantMsgId = parsed.reserved_assistant_message_id;
        continue;
      }

      const obj = parsed.obj as Record<string, unknown> | undefined;

      // Answer text
      if (obj?.type === 'message_delta' && typeof obj.content === 'string') {
        pieces.push(obj.content);
        continue;
      }
      if (typeof parsed.answer_piece === 'string') {
        pieces.push(parsed.answer_piece);
        continue;
      }

      // Source documents
      const rawDocs: unknown =
        (Array.isArray(obj?.top_documents) ? obj!.top_documents : undefined) ??
        (Array.isArray(parsed.top_documents) ? parsed.top_documents : undefined) ??
        (Array.isArray(obj?.documents) ? obj!.documents : undefined) ??
        (Array.isArray(parsed.documents) ? parsed.documents : undefined);

      if (Array.isArray(rawDocs) && rawDocs.length > 0) {
        for (const doc of rawDocs as Record<string, unknown>[]) {
          if (typeof doc.link === 'string' && doc.link) {
            documents.push({
              title: typeof doc.semantic_identifier === 'string' ? doc.semantic_identifier
                : typeof doc.title === 'string' ? doc.title : '',
              link: doc.link,
              source_type: typeof doc.source_type === 'string' ? doc.source_type : '',
              blurb: typeof doc.blurb === 'string' ? doc.blurb : '',
              updated_at: typeof doc.updated_at === 'string' ? doc.updated_at
                : typeof doc.updated_at === 'number' ? String(doc.updated_at) : null,
            });
          }
        }
      }
    }

    const answer = pieces.join('');
    if (!answer) this.logger.warn('Lokte send-message returned no answer content');
    return { answer, documents, reservedAssistantMsgId };
  }

  private async deleteLokteSession(token: string, lokteSessionId: string): Promise<void> {
    try {
      await fetch(`${LOKTE_BASE_URL}/api/chat/delete-chat-session/${lokteSessionId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (err) {
      // Non-fatal — local records are cleared regardless
      this.logger.warn(`Failed to delete Lokte session ${lokteSessionId}`, err);
    }
  }

  private async persistMessages(
    shopId: string,
    userId: string,
    question: string,
    answer: string,
  ): Promise<void> {
    try {
      await this.messageRepo.save([
        this.messageRepo.create({ shopId, userId, role: 'user', content: question }),
        this.messageRepo.create({ shopId, userId, role: 'assistant', content: answer }),
      ]);

      // Trim to HISTORY_LIMIT — delete oldest beyond cap
      const count = await this.messageRepo.count({ where: { shopId, userId } });
      if (count > HISTORY_LIMIT) {
        const oldest = await this.messageRepo.find({
          where: { shopId, userId },
          order: { createdAt: 'ASC' },
          take: count - HISTORY_LIMIT,
          select: ['id'],
        });
        await this.messageRepo.delete(oldest.map((m) => m.id));
      }
    } catch (err) {
      // Non-fatal — reply already returned to the user
      this.logger.error('Failed to persist chat messages', err);
    }
  }
}
