import { Injectable, LoggerService, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import winston from 'winston';

@Injectable()
export class LoggingService implements LoggerService {
  logger: winston.Logger;

  constructor(@Optional() private readonly config?: ConfigService) {
    const logLevel = this.config?.get<string>('LOG_LEVEL', 'info') ?? 'info';
    this.logger = winston.createLogger({
      format: winston.format.combine(
        winston.format.timestamp({
          format: 'YYYY-MM-DD HH:mm:ss', // タイムスタンプのフォーマットを変える
        }),
        winston.format.errors({ stack: true }), // エラー時はスタックトレースを出力する
        winston.format.printf(
          (info) =>
            `[${info.timestamp as string}] [${info.level.toUpperCase()}] ${info.message as string}`,
        ),
      ),
      transports: [
        new winston.transports.Console({
          level: logLevel,
        }),
      ],
    });
  }

  private formatMessage(message: string, context?: string): string {
    return context ? `[${context}] ${message}` : message;
  }

  log(message: string, context?: string) {
    this.logger.log({
      level: 'info',
      message: this.formatMessage(message, context),
    });
  }

  error(message: string, trace: string, context?: string) {
    const formattedMessage = this.formatMessage(message, context);
    const fullMessage = trace
      ? `${formattedMessage}:${trace}`
      : formattedMessage;
    this.logger.log({
      level: 'error',
      message: fullMessage,
    });
    // Slackに通知
    void this.notifySlack(fullMessage);
  }

  warn(message: string, context?: string) {
    this.logger.log({
      level: 'warn',
      message: this.formatMessage(message, context),
    });
  }

  debug(message: string, context?: string) {
    this.logger.log({
      level: 'debug',
      message: this.formatMessage(message, context),
    });
  }

  verbose(message: string, context?: string) {
    this.logger.log({
      level: 'verbose',
      message: this.formatMessage(message, context),
    });
  }

  /**
   * Slack通知を送る
   * @param text
   * @private
   */
  private async notifySlack(text: string) {
    const webhookUrl = this.config?.get<string>('SLACK_ERROR_WEBHOOK_URL');
    // SLACK_ERROR_WEBHOOK_URLが設定されていない場合は通知しない
    if (!webhookUrl) {
      return;
    }

    try {
      // Slack通知用のペイロード作成
      const payload = {
        text,
      };

      // Slack通知を送信
      await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
    } catch (error) {
      console.error('Failed to send Slack notification', error);
    }
  }
}
