import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/prisma.service';
import { AuthUser } from '../common/types/auth-user';

interface SuggestionResult {
  configured: boolean;
  message: string;
  suggestion?: string;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private isAiConfigured(): boolean {
    return Boolean(this.config.get<string>('AI_API_KEY'));
  }

  async getProfile(user: AuthUser, creatorId: string) {
    await this.assertCreatorInOrg(user.organizationId, creatorId);
    return this.prisma.aIProfile.findUnique({ where: { creatorId } });
  }

  async updateProfile(user: AuthUser, creatorId: string, data: Record<string, unknown>) {
    await this.assertCreatorInOrg(user.organizationId, creatorId);
    if (data.autoSendEnabled === true && !this.isAiConfigured()) {
      throw new BadRequestException(
        "Impossibile attivare l'invio automatico: nessun provider AI configurato (AI_API_KEY mancante).",
      );
    }
    return this.prisma.aIProfile.upsert({
      where: { creatorId },
      update: data as any,
      create: { creatorId, ...(data as any) },
    });
  }

  private async assertCreatorInOrg(organizationId: string, creatorId: string) {
    const creator = await this.prisma.creator.findFirst({ where: { id: creatorId, organizationId } });
    if (!creator) throw new NotFoundException('Creator non trovata.');
    return creator;
  }

  async suggestReply(user: AuthUser, conversationId: string): Promise<SuggestionResult> {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, creator: { organizationId: user.organizationId } },
      include: {
        creator: { include: { personality: true, aiProfile: true } },
        fan: { include: { aiMemories: true } },
        messages: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    });
    if (!conversation) throw new NotFoundException('Conversazione non trovata.');

    if (!conversation.creator.aiProfile || conversation.creator.aiProfile.mode === 'DISABLED') {
      return { configured: false, message: 'AI disattivata per questa creator. Attivala dalla scheda AI del profilo.' };
    }

    if (!this.isAiConfigured()) {
      return {
        configured: false,
        message:
          'Provider AI non configurato. Imposta AI_PROVIDER e AI_API_KEY nelle variabili d\'ambiente per attivare i suggerimenti.',
      };
    }

    const provider = this.config.get<string>('AI_PROVIDER') || 'openai';
    const model = conversation.creator.aiProfile.model || this.config.get<string>('AI_MODEL') || 'gpt-4o-mini';
    const apiKey = this.config.get<string>('AI_API_KEY')!;

    const systemPrompt = this.buildSystemPrompt(conversation.creator);
    const history = conversation.messages
      .reverse()
      .map((m) => `${m.direction === 'INBOUND' ? 'Fan' : 'Chatter'}: ${m.body ?? '[media]'}`)
      .join('\n');

    try {
      const suggestion = await this.callAiProvider(provider, apiKey, model, systemPrompt, history);

      await this.prisma.aIUsageLog.create({
        data: {
          creatorId: conversation.creatorId,
          provider,
          model,
          promptTokens: Math.ceil((systemPrompt.length + history.length) / 4),
          completionTokens: Math.ceil(suggestion.length / 4),
        },
      });

      return { configured: true, message: 'Suggerimento generato.', suggestion };
    } catch (error) {
      this.logger.error(error);
      return { configured: true, message: `Generazione fallita: ${(error as Error).message}` };
    }
  }

  private buildSystemPrompt(creator: { stageName: string; personality: any; aiProfile: any }): string {
    const p = creator.personality;
    const parts = [
      `Sei l'assistente di scrittura per la creator "${creator.stageName}" su OnlyFans.`,
      p?.tone ? `Tono: ${p.tone}.` : '',
      p?.forbiddenTopics?.length ? `Argomenti vietati: ${p.forbiddenTopics.join(', ')}.` : '',
      p?.forbiddenWords?.length ? `Parole vietate: ${p.forbiddenWords.join(', ')}.` : '',
      creator.aiProfile?.systemPrompt || '',
      'Genera una singola risposta breve, naturale, in italiano, senza esplicitare che sei un AI.',
    ];
    return parts.filter(Boolean).join('\n');
  }

  private async callAiProvider(
    provider: string,
    apiKey: string,
    model: string,
    systemPrompt: string,
    history: string,
  ): Promise<string> {
    // Endpoint compatibile OpenAI (chat completions). Altri provider possono essere
    // aggiunti qui seguendo lo stesso pattern usato per i provider OnlyFans.
    const baseUrl = provider === 'openai' ? 'https://api.openai.com/v1' : this.config.get<string>('AI_BASE_URL');
    if (!baseUrl) throw new Error(`Nessun endpoint configurato per il provider AI "${provider}".`);

    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Conversazione recente:\n${history}\n\nScrivi la prossima risposta del chatter.` },
        ],
        temperature: 0.7,
        max_tokens: 300,
      }),
    });
    if (!res.ok) throw new Error(`Provider AI ha risposto HTTP ${res.status}`);
    const body = await res.json();
    return body.choices?.[0]?.message?.content ?? '';
  }

  async listMemories(user: AuthUser, fanId: string) {
    const fan = await this.prisma.fan.findFirst({ where: { id: fanId, organizationId: user.organizationId } });
    if (!fan) throw new NotFoundException('Fan non trovato.');
    return this.prisma.aIMemory.findMany({ where: { fanId }, orderBy: { updatedAt: 'desc' } });
  }

  async addMemory(user: AuthUser, fanId: string, key: string, value: string) {
    const fan = await this.prisma.fan.findFirst({ where: { id: fanId, organizationId: user.organizationId } });
    if (!fan) throw new NotFoundException('Fan non trovato.');
    return this.prisma.aIMemory.create({ data: { fanId, key, value } });
  }

  async deleteMemory(user: AuthUser, fanId: string, memoryId: string) {
    const fan = await this.prisma.fan.findFirst({ where: { id: fanId, organizationId: user.organizationId } });
    if (!fan) throw new NotFoundException('Fan non trovato.');
    await this.prisma.aIMemory.deleteMany({ where: { id: memoryId, fanId } });
    return { success: true };
  }
}
