import { FastifyRequest, FastifyReply } from "fastify";
import { prismaApp } from "../../core/config/databaseConfig";
import logger from "../../core/config/loggerConfig";
import { fetchWithCache } from "../../core/config/redisConfig";
import { normalizePhone } from "../../core/utils/phone";

export const getCategories = async (req: FastifyRequest, res: FastifyReply) => {
  try {
    const categories = await fetchWithCache("data:categories", 60, () =>
      prismaApp.category.findMany({ orderBy: { sort_order: "asc" } }),
    );
    return res.send(categories);
  } catch (error: any) {
    logger.error(`Error in getCategories: ${error.message}`);
    return res.status(500).send({ error: "Internal Server Error" });
  }
};

export const getProducts = async (req: FastifyRequest, res: FastifyReply) => {
  try {
    const products = await fetchWithCache("data:products", 60, () =>
      prismaApp.product.findMany({
        orderBy: [{ sort_order: "asc" }, { name: "asc" }],
      }),
    );
    return res.send(products);
  } catch (error: any) {
    logger.error(`Error in getProducts: ${error.message}`);
    return res.status(500).send({ error: "Internal Server Error" });
  }
};

export const getOffers = async (req: FastifyRequest, res: FastifyReply) => {
  try {
    const offers = await fetchWithCache("data:offers", 60, () =>
      prismaApp.offer.findMany({ orderBy: { id: "desc" } }),
    );
    return res.send(offers);
  } catch (error: any) {
    logger.error(`Error in getOffers: ${error.message}`);
    return res.status(500).send({ error: "Internal Server Error" });
  }
};

export const getDiscounts = async (req: FastifyRequest, res: FastifyReply) => {
  try {
    const discounts = await fetchWithCache("data:discounts", 60, () =>
      prismaApp.discount.findMany({ orderBy: { id: "desc" } }),
    );
    return res.send(discounts);
  } catch (error: any) {
    logger.error(`Error in getDiscounts: ${error.message}`);
    return res.status(500).send({ error: "Internal Server Error" });
  }
};

export const getLoyaltyRules = async (req: FastifyRequest, res: FastifyReply) => {
  try {
    const rules = await fetchWithCache("data:loyaltyRules", 60, () =>
      prismaApp.loyaltyRule.findMany({ orderBy: { visits_required: "asc" } }),
    );
    return res.send(rules);
  } catch (error: any) {
    logger.error(`Error in getLoyaltyRules: ${error.message}`);
    return res.status(500).send({ error: "Internal Server Error" });
  }
};

export const getTables = async (req: FastifyRequest, res: FastifyReply) => {
  try {
    const tables = await fetchWithCache("data:tables", 60, () =>
      prismaApp.restaurantTable.findMany({ orderBy: { table_number: "asc" } }),
    );
    return res.send(tables);
  } catch (error: any) {
    logger.error(`Error in getTables: ${error.message}`);
    return res.status(500).send({ error: "Internal Server Error" });
  }
};

export const getInventory = async (req: FastifyRequest, res: FastifyReply) => {
  try {
    const inventory = await fetchWithCache("data:inventory", 60, () =>
      prismaApp.inventoryItem.findMany({ orderBy: { name: "asc" } }),
    );
    return res.send(inventory);
  } catch (error: any) {
    logger.error(`Error in getInventory: ${error.message}`);
    return res.status(500).send({ error: "Internal Server Error" });
  }
};

export const getCustomers = async (req: FastifyRequest, res: FastifyReply) => {
  try {
    const customers = await fetchWithCache("data:customers", 60, () =>
      prismaApp.user.findMany({
        where: { role: "USER" },
        orderBy: { total_spend: "desc" },
      }),
    );

    // Group by normalized phone number to merge duplicates created before normalization
    const grouped = new Map<string, any>();
    for (const u of customers) {
      if (!u.phone) continue;
      const np = normalizePhone(u.phone);
      if (grouped.has(np)) {
        const existing = grouped.get(np);
        existing.visits += u.visits;
        existing.reward_points += u.reward_points;
        existing.total_spend = Number(existing.total_spend) + Number(u.total_spend);
        if (u.last_visit && (!existing.last_visit || u.last_visit > existing.last_visit)) {
          existing.last_visit = u.last_visit;
        }
      } else {
        grouped.set(np, {
          ...u,
          phone: np,
          total_spend: Number(u.total_spend),
        });
      }
    }

    const merged = Array.from(grouped.values()).sort((a, b) => b.total_spend - a.total_spend);
    return res.send(merged);
  } catch (error: any) {
    logger.error(`Error in getCustomers: ${error.message}`);
    return res.status(500).send({ error: "Internal Server Error" });
  }
};

export const getOrders = async (req: FastifyRequest, res: FastifyReply) => {
  try {
    const orders = await prismaApp.order.findMany({
      include: { order_items: true },
      orderBy: { created_at: "desc" },
      take: 100,
    });
    return res.send(orders);
  } catch (error: any) {
    logger.error(`Error in getOrders: ${error.message}`);
    return res.status(500).send({ error: "Internal Server Error" });
  }
};

export const getNotifications = async (req: FastifyRequest, res: FastifyReply) => {
  try {
    const notifications = await prismaApp.appNotification.findMany({
      orderBy: { created_at: "desc" },
      take: 60,
    });
    return res.send(notifications);
  } catch (error: any) {
    logger.error(`Error in getNotifications: ${error.message}`);
    return res.status(500).send({ error: "Internal Server Error" });
  }
};
