import {
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ContractStatus, DealStage, PaymentStatus } from '@prisma/client';

// ===========================================================================
// Deals
// ===========================================================================

export class CreateDealDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  brand: string;

  @IsUUID()
  influencerId: string;

  @IsNumber()
  @Min(0)
  offer: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  floor?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  ceiling?: number;

  @IsOptional()
  @IsEnum(DealStage)
  stage?: DealStage;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class UpdateDealDto {
  @IsOptional() @IsString() @MaxLength(120) brand?: string;
  @IsOptional() @IsUUID() influencerId?: string;
  @IsOptional() @IsNumber() @Min(0) offer?: number;
  @IsOptional() @IsNumber() @Min(0) floor?: number;
  @IsOptional() @IsNumber() @Min(0) ceiling?: number;
  @IsOptional() @IsEnum(DealStage) stage?: DealStage;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}

export class ChangeDealStageDto {
  @IsEnum(DealStage)
  stage: DealStage;
}

// ===========================================================================
// Influencers
// ===========================================================================

export class CreateInfluencerDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name: string;

  @IsOptional() @IsString() @MaxLength(80) handle?: string;
  @IsOptional() @IsString() @MaxLength(40) platform?: string;
  @IsOptional() @IsInt() @Min(0) followers?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(100) engagement?: number;
  @IsOptional() @IsString() @MaxLength(120) email?: string;
  @IsOptional() @IsString() @MaxLength(40) phone?: string;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}

export class UpdateInfluencerDto {
  @IsOptional() @IsString() @MaxLength(120) name?: string;
  @IsOptional() @IsString() @MaxLength(80) handle?: string;
  @IsOptional() @IsString() @MaxLength(40) platform?: string;
  @IsOptional() @IsInt() @Min(0) followers?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(100) engagement?: number;
  @IsOptional() @IsString() @MaxLength(120) email?: string;
  @IsOptional() @IsString() @MaxLength(40) phone?: string;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}

// ===========================================================================
// Payments / Commercials
// ===========================================================================

export class CreatePaymentDto {
  @IsUUID()
  influencerId: string;

  @IsOptional()
  @IsUUID()
  dealId?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  brand: string;

  @IsOptional() @IsString() @MaxLength(500) description?: string;

  @IsNumber()
  @Min(0)
  amount: number;

  @IsOptional() @IsString() @MaxLength(8) currency?: string;
  @IsOptional() @IsDateString() dueAt?: string;
  @IsOptional() @IsEnum(PaymentStatus) paymentStatus?: PaymentStatus;
}

export class UpdatePaymentDto {
  @IsOptional() @IsString() @MaxLength(120) brand?: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
  @IsOptional() @IsNumber() @Min(0) amount?: number;
  @IsOptional() @IsString() @MaxLength(8) currency?: string;
  @IsOptional() @IsDateString() dueAt?: string;
  @IsOptional() @IsDateString() invoicedAt?: string;
  @IsOptional() @IsDateString() paidAt?: string;
  @IsOptional() @IsEnum(PaymentStatus) paymentStatus?: PaymentStatus;
}

export class PaymentStatusActionDto {
  @IsIn(['mark_invoiced', 'mark_paid', 'send_reminder'])
  action: 'mark_invoiced' | 'mark_paid' | 'send_reminder';
}

// ===========================================================================
// Contracts
// ===========================================================================

export class CreateContractDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  brand: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  templateName: string;

  @IsOptional() @IsUUID() influencerId?: string;
  @IsOptional() @IsUUID() dealId?: string;
  @IsOptional() @IsEnum(ContractStatus) status?: ContractStatus;
  @IsOptional() @IsDateString() expiresAt?: string;
  @IsOptional() @IsUrl({ require_tld: false }) documentUrl?: string;
}

export class UpdateContractDto {
  @IsOptional() @IsString() @MaxLength(120) brand?: string;
  @IsOptional() @IsString() @MaxLength(120) templateName?: string;
  @IsOptional() @IsEnum(ContractStatus) status?: ContractStatus;
  @IsOptional() @IsDateString() sentAt?: string;
  @IsOptional() @IsDateString() signedAt?: string;
  @IsOptional() @IsDateString() expiresAt?: string;
  @IsOptional() @IsUrl({ require_tld: false }) documentUrl?: string;
}
