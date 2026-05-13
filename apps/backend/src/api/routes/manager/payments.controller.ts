import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Organization } from '@prisma/client';
import { GetOrgFromRequest } from '@gitroom/nestjs-libraries/user/org.from.request';
import { PaymentService } from '@gitroom/nestjs-libraries/database/prisma/manager/payment.service';
import {
  CreatePaymentDto,
  PaymentStatusActionDto,
  UpdatePaymentDto,
} from '@gitroom/nestjs-libraries/dtos/manager/manager.dto';

@ApiTags('Manager')
@Controller('/manager/payments')
export class PaymentsController {
  constructor(private _payments: PaymentService) {}

  @Get('/')
  list(@GetOrgFromRequest() org: Organization) {
    return this._payments.list(org.id);
  }

  @Get('/summary')
  summary(@GetOrgFromRequest() org: Organization) {
    return this._payments.summary(org.id);
  }

  @Get('/:id')
  async get(@GetOrgFromRequest() org: Organization, @Param('id') id: string) {
    const row = await this._payments.get(org.id, id);
    if (!row) throw new HttpException('Payment not found', 404);
    return row;
  }

  @Post('/')
  create(@GetOrgFromRequest() org: Organization, @Body() body: CreatePaymentDto) {
    return this._payments.create(org.id, body);
  }

  @Put('/:id')
  update(
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string,
    @Body() body: UpdatePaymentDto
  ) {
    return this._payments.update(org.id, id, body);
  }

  @Post('/:id/action')
  action(
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string,
    @Body() body: PaymentStatusActionDto
  ) {
    if (body.action === 'mark_invoiced') return this._payments.markInvoiced(org.id, id);
    if (body.action === 'mark_paid') return this._payments.markPaid(org.id, id);
    if (body.action === 'send_reminder') return this._payments.sendReminder(org.id, id);
    throw new HttpException('Unknown action', 400);
  }

  @Delete('/:id')
  remove(@GetOrgFromRequest() org: Organization, @Param('id') id: string) {
    return this._payments.remove(org.id, id);
  }
}
