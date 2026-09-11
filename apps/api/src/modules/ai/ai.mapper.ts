import {
  AiWalletResponseDto,
  AiUsageLogResponseDto,
  AiCompletionResponseDto,
} from './dto/ai.dto.js';
import { AiProviderType } from '@trueco/types';

export class AiMapper {
  public static toWalletDto(raw: any): AiWalletResponseDto {
    return {
      id: raw.id,
      coachingId: raw.coachingId,
      balance: raw.balance ?? 0,
      totalAllocated: raw.totalAllocated ?? 0,
      totalConsumed: raw.totalConsumed ?? 0,
      updatedAt: raw.updatedAt instanceof Date ? raw.updatedAt : new Date(raw.updatedAt),
    };
  }

  public static toUsageLogDto(raw: any): AiUsageLogResponseDto {
    return {
      id: raw.id,
      walletId: raw.walletId,
      feature: raw.feature,
      provider: raw.provider as AiProviderType,
      model: raw.model,
      promptTokens: raw.promptTokens ?? 0,
      completionTokens: raw.completionTokens ?? 0,
      creditsDeducted: raw.creditsDeducted ?? 0,
      inputHash: raw.inputHash ?? null,
      createdAt: raw.createdAt instanceof Date ? raw.createdAt : new Date(raw.createdAt),
    };
  }

  public static toCompletionDto(params: {
    content: string;
    feature: string;
    provider: AiProviderType;
    model: string;
    promptTokens: number;
    completionTokens: number;
    creditsDeducted: number;
    isCached: boolean;
    balanceRemaining: number;
  }): AiCompletionResponseDto {
    return {
      content: params.content,
      feature: params.feature,
      provider: params.provider,
      model: params.model,
      promptTokens: params.promptTokens,
      completionTokens: params.completionTokens,
      creditsDeducted: params.creditsDeducted,
      isCached: params.isCached,
      balanceRemaining: params.balanceRemaining,
    };
  }
}
