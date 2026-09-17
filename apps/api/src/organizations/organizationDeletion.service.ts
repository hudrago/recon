import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';

@Injectable()
export class OrganizationDeletionService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async deleteEmptyOrganization(orgId: string, userId: string, confirmation: string): Promise<void> {
    await this.prisma.$transaction(
      async (transaction) => {
        const organization = await transaction.organization.findUnique({
          where: { id: orgId },
          include: { members: { select: { userId: true, role: true } } },
        });
        if (!organization) throw new NotFoundException();

        const membership = organization.members.find(
          (member) => member.userId === userId,
        );
        if (
          !membership?.role
            .split(",")
            .map((role) => role.trim())
            .includes("owner")
        )
          throw new ForbiddenException();
        if (organization.slug !== confirmation)
          throw new ConflictException("ORGANIZATION_CONFIRMATION_MISMATCH");
        if (organization.members.length !== 1)
          throw new ConflictException("ORGANIZATION_HAS_OTHER_MEMBERS");

        // Subscription rows aren't counted here: every organization gets one automatically at
        // creation (see BetterAuthService's afterCreateOrganization hook), and it cascades away
        // with the organization (see the Subscription foreign key). Only real financial/operational
        // history — actual paid orders and invoices — should block deletion.
        const [
          exceptions,
          pending,
          refunds,
          invoices,
          adjustments,
          shipments,
          webhooks,
          actions,
          audits,
          processedOrders,
          billingInvoices,
        ] = await Promise.all([
          transaction.exceptionRecord.count({ where: { orgId } }),
          transaction.pendingEvaluation.count({ where: { orgId } }),
          transaction.refundRecord.count({ where: { orgId } }),
          transaction.invoiceRecord.count({ where: { orgId } }),
          transaction.inventoryAdjustmentRecord.count({ where: { orgId } }),
          transaction.shipmentRecord.count({ where: { orgId } }),
          transaction.webhookReceipt.count({ where: { orgId } }),
          transaction.executedAction.count({ where: { orgId } }),
          transaction.auditLogEntry.count({ where: { orgId } }),
          transaction.processedOrder.count({ where: { orgId } }),
          transaction.billingInvoice.count({ where: { orgId } }),
        ]);
        if (
          exceptions +
            pending +
            refunds +
            invoices +
            adjustments +
            shipments +
            webhooks +
            actions +
            audits +
            processedOrders +
            billingInvoices >
          0
        )
          throw new ConflictException("ORGANIZATION_RETENTION_REQUIRED");

        await transaction.session.updateMany({
          where: { activeOrganizationId: orgId },
          data: { activeOrganizationId: null },
        });
        await transaction.organization.delete({ where: { id: orgId } });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
}