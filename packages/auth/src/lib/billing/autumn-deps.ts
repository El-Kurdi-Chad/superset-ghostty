import { db } from "@superset/db/client";
import { subscriptions } from "@superset/db/schema";
import { APIError } from "better-auth/api";
import { and, desc, eq, inArray } from "drizzle-orm";
import { autumnClient } from "../../autumn";
import { env } from "../../env";
import { stripeClient } from "../../stripe";
import { countBillableSeats } from "../../utils/billing";
import type { AutumnBillingDeps } from "./autumn-endpoints";
import { seatItem } from "./subscription-row";
import {
	completeCheckout,
	currentAutumnPlanId,
	ensureAutumnCustomer,
	syncFromStripeEvent,
	syncOrganizationSubscription,
} from "./sync-subscription";

const SYNCED_STRIPE_EVENTS = new Set([
	"checkout.session.completed",
	"customer.subscription.created",
	"customer.subscription.updated",
	"customer.subscription.deleted",
	"invoice.paid",
	"invoice.payment_failed",
]);

export function autumnBillingDeps(): AutumnBillingDeps {
	if (!autumnClient) throw new Error("AUTUMN_SECRET_KEY is not set");
	const autumn = autumnClient;
	return {
		attach: (params) => autumn.billing.attach(params),
		update: (params) => autumn.billing.update(params),
		managedByAutumn: async (organizationId) =>
			(await currentAutumnPlanId(organizationId).catch(() => null)) !== null,
		cancelPortalUrl: async (subscription, returnUrl) => {
			const { url } = await stripeClient.billingPortal.sessions.create({
				customer: subscription.stripeCustomerId,
				return_url: returnUrl,
				flow_data: {
					type: "subscription_cancel",
					subscription_cancel: {
						subscription: subscription.stripeSubscriptionId,
					},
				},
			});
			return url;
		},
		switchIntervalPortalUrl: async (subscription, annual, returnUrl) => {
			const current = await stripeClient.subscriptions.retrieve(
				subscription.stripeSubscriptionId,
			);
			const seat = seatItem(current);
			if (!seat) {
				throw new APIError("BAD_REQUEST", {
					code: "SUBSCRIPTION_NOT_FOUND",
					message: "Subscription not found",
				});
			}
			const { url } = await stripeClient.billingPortal.sessions.create({
				customer: subscription.stripeCustomerId,
				return_url: returnUrl,
				flow_data: {
					type: "subscription_update_confirm",
					after_completion: {
						type: "redirect",
						redirect: { return_url: returnUrl },
					},
					subscription_update_confirm: {
						subscription: subscription.stripeSubscriptionId,
						items: [
							{
								id: seat.id,
								price: annual
									? env.STRIPE_PRO_YEARLY_PRICE_ID
									: env.STRIPE_PRO_MONTHLY_PRICE_ID,
								quantity: seat.quantity ?? 1,
							},
						],
					},
				},
			});
			return url;
		},
		restoreInStripe: async (subscription) => {
			if (subscription.stripeScheduleId) {
				const schedule = await stripeClient.subscriptionSchedules.retrieve(
					subscription.stripeScheduleId,
				);
				if (schedule.status === "active") {
					await stripeClient.subscriptionSchedules.release(schedule.id);
				}
				return;
			}
			const current = await stripeClient.subscriptions.retrieve(
				subscription.stripeSubscriptionId,
			);
			await stripeClient.subscriptions.update(
				current.id,
				current.cancel_at ? { cancel_at: "" } : { cancel_at_period_end: false },
			);
		},
		ensureCustomer: ensureAutumnCustomer,
		currentPlanId: currentAutumnPlanId,
		findLiveSubscription: async (organizationId) =>
			(await db.query.subscriptions.findFirst({
				where: and(
					eq(subscriptions.referenceId, organizationId),
					inArray(subscriptions.status, ["active", "trialing"]),
				),
				orderBy: desc(subscriptions.createdAt),
			})) ?? null,
		countBillableSeats,
		sync: syncOrganizationSubscription,
		completeCheckout,
		handleStripeWebhook: async (request) => {
			const signature = request.headers.get("stripe-signature");
			if (!signature) {
				throw new APIError("BAD_REQUEST", {
					message: "Stripe webhook secret not found",
				});
			}
			const event = await stripeClient.webhooks
				.constructEventAsync(
					await request.text(),
					signature,
					env.STRIPE_WEBHOOK_SECRET,
				)
				.catch(() => {
					throw new APIError("BAD_REQUEST", {
						message: "Failed to construct Stripe event",
					});
				});
			if (SYNCED_STRIPE_EVENTS.has(event.type)) {
				await syncFromStripeEvent(event);
			}
		},
	};
}
