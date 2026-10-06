import type { FarmDto, PlanLimits, SubscriptionDto } from '@agrovax/shared';
import type { Farm, Membership, Plan, Subscription } from '@prisma/client';

export type MembershipWithFarm = Membership & {
  farm: Farm & { subscription: (Subscription & { plan: Plan }) | null };
};

/** Inclusao padrao para montar um FarmDto a partir de um Membership. */
export const membershipInclude = {
  farm: { include: { subscription: { include: { plan: true } } } },
} as const;

const NO_PLAN_LIMITS: PlanLimits = { maxAnimals: 0, maxLots: 0, maxUsers: 1 };

function toSubscriptionDto(subscription: (Subscription & { plan: Plan }) | null): SubscriptionDto {
  if (!subscription) {
    // Nao deveria acontecer (toda fazenda nasce com assinatura); falha de forma restritiva.
    return { plan: 'FREE', status: 'EXPIRED', expiresAt: null, limits: NO_PLAN_LIMITS, features: {} };
  }
  const expired = subscription.expiresAt !== null && subscription.expiresAt.getTime() < Date.now();
  return {
    plan: subscription.plan.code,
    status: expired && subscription.status === 'ACTIVE' ? 'EXPIRED' : subscription.status,
    expiresAt: subscription.expiresAt?.toISOString() ?? null,
    limits: subscription.plan.limits as unknown as PlanLimits,
    features: subscription.plan.features as Record<string, boolean>,
  };
}

export function toFarmDto(membership: MembershipWithFarm): FarmDto {
  const { farm } = membership;
  return {
    id: farm.id,
    name: farm.name,
    city: farm.city,
    state: farm.state,
    role: membership.role,
    subscription: toSubscriptionDto(farm.subscription),
  };
}
