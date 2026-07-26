import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../common/prisma.service';

/**
 * Motore di esecuzione reale (ma volutamente limitato) delle automazioni.
 * Gestisce EXPIRATION e RENEW_OFF leggendo dati reali da FanCreatorLink e creando
 * notifiche in-app + log di automazione. Non invia mai messaggi automaticamente
 * su OnlyFans: l'invio automatico resta sempre un'azione separata, esplicita e
 * disattivata di default (vedi AIProfile.autoSendEnabled).
 */
@Injectable()
export class AutomationsRunnerService {
  private readonly logger = new Logger(AutomationsRunnerService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async runHourly() {
    const activeAutomations = await this.prisma.automation.findMany({
      where: { isActive: true, trigger: { in: ['EXPIRATION', 'RENEW_OFF'] } },
    });

    for (const automation of activeAutomations) {
      try {
        const conditions = (automation.conditions as { daysBefore?: number }) || {};
        const daysBefore = conditions.daysBefore ?? 3;
        const targetDate = new Date(Date.now() + daysBefore * 24 * 60 * 60 * 1000);

        const expiringLinks = await this.prisma.fanCreatorLink.findMany({
          where:
            automation.trigger === 'EXPIRATION'
              ? { expiresAt: { lte: targetDate, gte: new Date() }, subscriptionStatus: 'active' }
              : { renewOn: false, subscriptionStatus: 'active' },
          include: { fan: true, creator: true },
          take: 100,
        });

        for (const link of expiringLinks) {
          await this.prisma.notification.create({
            data: {
              organizationId: automation.organizationId,
              type: automation.trigger,
              title:
                automation.trigger === 'EXPIRATION'
                  ? `Abbonamento in scadenza: ${link.fan.username}`
                  : `Rinnovo disattivato: ${link.fan.username}`,
              body: `Creator: ${link.creator.stageName}`,
              channel: 'in_app',
            },
          });
        }

        await this.prisma.automationLog.create({
          data: {
            automationId: automation.id,
            status: 'success',
            message: `Elaborati ${expiringLinks.length} fan.`,
          },
        });
      } catch (error) {
        this.logger.error(`Automazione ${automation.id} fallita`, error as Error);
        await this.prisma.automationLog.create({
          data: { automationId: automation.id, status: 'error', message: (error as Error).message },
        });
      }
    }
  }
}
