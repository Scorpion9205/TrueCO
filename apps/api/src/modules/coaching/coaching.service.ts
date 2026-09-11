import { StatusCodes } from 'http-status-codes';
import { ICoachingRepository } from './coaching.repository.js';
import { IPasswordService } from '../../common/security/password.service.js';
import { IEventBus } from '../../events/event-bus.interface.js';
import { AppError } from '../../common/middleware/error-handler.middleware.js';
import { CoachingMapper } from './coaching.mapper.js';
import { CoachingResponseDto, RegisterCoachingDto } from './dto/coaching.dto.js';
import { createCoachingCreatedEvent } from './coaching.events.js';

export class CoachingService {
  public constructor(
    private readonly coachingRepository: ICoachingRepository,
    private readonly passwordService: IPasswordService,
    private readonly eventBus: IEventBus,
  ) {}

  public async registerCoaching(
    dto: RegisterCoachingDto,
    correlationId: string = crypto.randomUUID(),
  ): Promise<CoachingResponseDto> {
    // 1. Check if coaching code is taken
    const existing = await this.coachingRepository.findByCode(dto.coachingCode);
    if (existing) {
      throw new AppError(
        'CODE_CONFLICT',
        `Coaching code '${dto.coachingCode}' is already registered. Please choose another code.`,
        StatusCodes.CONFLICT,
      );
    }

    // 2. Hash owner password with Argon2id
    const ownerPasswordHash = await this.passwordService.hash(dto.ownerPassword);

    // 3. Atomically provision Coaching, Owner User, 60-day full-feature trial, and AI wallet
    const { coaching, ownerUser } = await this.coachingRepository.createWithProvisioning({
      coachingName: dto.coachingName,
      coachingCode: dto.coachingCode,
      phone: dto.phone,
      email: dto.email,
      address: dto.address,
      city: dto.city,
      state: dto.state,
      timezone: dto.timezone || 'Asia/Kolkata',
      currency: dto.currency || 'INR',
      ownerName: dto.ownerName,
      ownerEmail: dto.ownerEmail,
      ownerPhone: dto.ownerPhone,
      ownerPasswordHash,
      trialDays: 60, // 60-day trial per ADD §19.2
      initialCredits: 500, // 500 AI credits trial allotment
    });

    const responseDto = CoachingMapper.toResponseDto(coaching);

    // 4. Emit Domain Event
    await this.eventBus.publish(
      createCoachingCreatedEvent(
        {
          coachingId: coaching.id,
          coachingCode: coaching.code,
          coachingName: coaching.name,
          ownerId: ownerUser.id,
          ownerEmail: ownerUser.email,
          trialEndsAt: responseDto.subscription.trialEndsAt,
        },
        correlationId,
      ),
    );

    return responseDto;
  }

  public async getCoachingById(id: string): Promise<CoachingResponseDto> {
    const coaching = await this.coachingRepository.findById(id);
    if (!coaching) {
      throw new AppError('NOT_FOUND', 'Coaching institute profile not found', StatusCodes.NOT_FOUND);
    }
    return CoachingMapper.toResponseDto(coaching);
  }
}
