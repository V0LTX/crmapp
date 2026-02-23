const prisma = require("../config/prisma");
const env = require("../config/env");
const { Roles, ClientStatuses } = require("../constants/enums");
const { normalizeToWorkDate, calculateNextVisitDate, addWorkDaysWith28DayMonth } = require("../utils/dateUtils");
const { createHttpError } = require("../utils/httpError");

const clientWithRelations = {
  region: {
    select: {
      id: true,
      code: true,
      name: true
    }
  }
};

function buildClientWhere(filters, user) {
  const where = {};

  if (user.role === Roles.REPRESENTATIVE) {
    where.regionId = user.regionId;
  }

  if (filters.regionId) {
    where.regionId = Number(filters.regionId);
  }

  if (filters.visitType) {
    where.visitType = filters.visitType;
  }

  if (filters.status) {
    where.status = filters.status;
  }

  if (filters.search) {
    where.OR = [
      { name: { contains: filters.search, mode: "insensitive" } },
      { phone: { contains: filters.search, mode: "insensitive" } },
      { address: { contains: filters.search, mode: "insensitive" } },
      { products: { contains: filters.search, mode: "insensitive" } }
    ];
  }

  if (filters.dueOnly === true) {
    where.nextVisitDate = {
      lte: normalizeToWorkDate(new Date())
    };
  }

  return where;
}

function enforceClientScope(user, client) {
  if (!client) {
    throw createHttpError(404, "العميل غير موجود");
  }

  if (user.role === Roles.REPRESENTATIVE && Number(user.regionId) !== Number(client.regionId)) {
    throw createHttpError(403, "لا يمكنك الوصول لهذا العميل");
  }
}

async function listClients(filters, user) {
  const page = filters.page || 1;
  const pageSize = filters.pageSize || 20;
  const where = buildClientWhere(filters, user);

  const [items, total] = await Promise.all([
    prisma.client.findMany({
      where,
      include: clientWithRelations,
      orderBy: [{ nextVisitDate: "asc" }, { id: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize
    }),
    prisma.client.count({ where })
  ]);

  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize)
  };
}

async function getClientById(id, user, includeVisits = false) {
  const client = await prisma.client.findUnique({
    where: { id: Number(id) },
    include: {
      ...clientWithRelations,
      ...(includeVisits
        ? {
            visits: {
              include: {
                visitedBy: {
                  select: {
                    id: true,
                    name: true,
                    email: true
                  }
                }
              },
              orderBy: {
                visitDate: "desc"
              }
            }
          }
        : {})
    }
  });

  enforceClientScope(user, client);
  return client;
}

function canRetryRejectedClient(client, referenceDate = new Date()) {
  if (client.status !== ClientStatuses.REJECTED) {
    return true;
  }

  const today = normalizeToWorkDate(referenceDate);
  const retryDate = normalizeToWorkDate(client.nextVisitDate);
  return today.getTime() >= retryDate.getTime();
}

function resolveNextVisitDate({ currentDate, visitType, outcome, rejectedRetryDays }) {
  if (outcome === ClientStatuses.REJECTED) {
    // After rejection, schedule a future retry date.
    return addWorkDaysWith28DayMonth(normalizeToWorkDate(new Date()), rejectedRetryDays);
  }

  if (outcome === ClientStatuses.NO_ANSWER) {
    return currentDate;
  }

  return calculateNextVisitDate(normalizeToWorkDate(new Date()), visitType);
}

function getVisitTypeLabel(type) {
  const labels = {
    WEEKLY: "أسبوعي",
    BIWEEKLY: "كل أسبوعين",
    MONTHLY: "شهري"
  };

  return labels[type] || type;
}

async function handleClientVisit({ clientId, user, outcome, note, visitType }) {
  const existingClient = await getClientById(clientId, user, false);

  if (existingClient.status === ClientStatuses.REJECTED && outcome === ClientStatuses.NO_ANSWER) {
    const canRetry = canRetryRejectedClient(existingClient);
    if (!canRetry) {
      throw createHttpError(400, `يمكن إعادة المحاولة مع هذا العميل بعد ${normalizeToWorkDate(existingClient.nextVisitDate).toISOString().slice(0, 10)}`);
    }
  }

  const previousStatus = existingClient.status;
  const previousNextVisitDate = existingClient.nextVisitDate;
  const nextVisitType = visitType || existingClient.visitType;
  const visitTypeChanged = existingClient.visitType !== nextVisitType;

  const newStatus = outcome;
  const newNextVisitDate = resolveNextVisitDate({
    currentDate: existingClient.nextVisitDate,
    visitType: nextVisitType,
    outcome,
    rejectedRetryDays: env.rejectedRetryDays
  });

  const statusRecoveryNote =
    previousStatus === ClientStatuses.REJECTED && newStatus === ClientStatuses.ACTIVE
      ? "تمت إعادة تفعيل العميل بعد فترة رفض"
      : null;

  const visitTypeChangeNote = visitTypeChanged
    ? `تم تغيير نوع الزيارة من ${getVisitTypeLabel(existingClient.visitType)} إلى ${getVisitTypeLabel(nextVisitType)}`
    : null;

  const generatedNote = [note, statusRecoveryNote, visitTypeChangeNote].filter(Boolean).join(" | ") || null;

  return prisma.$transaction(async (tx) => {
    const updatedClient = await tx.client.update({
      where: { id: existingClient.id },
      data: {
        status: newStatus,
        nextVisitDate: newNextVisitDate,
        visitType: nextVisitType
      },
      include: clientWithRelations
    });

    await tx.visitHistory.create({
      data: {
        clientId: existingClient.id,
        visitedById: user.id,
        previousStatus,
        newStatus,
        note: generatedNote,
        previousNextVisitDate,
        newNextVisitDate,
        visitDate: new Date()
      }
    });

    return updatedClient;
  });
}

async function handleRegionClients({ regionId, user, note }) {
  if (user.role === Roles.REPRESENTATIVE && Number(user.regionId) !== Number(regionId)) {
    throw createHttpError(403, "لا يمكنك إدارة هذه المنطقة");
  }

  const region = await prisma.region.findUnique({
    where: { id: Number(regionId) }
  });

  if (!region) {
    throw createHttpError(404, "المنطقة غير موجودة");
  }

  const clients = await prisma.client.findMany({
    where: {
      regionId: Number(regionId),
      status: {
        not: ClientStatuses.REJECTED
      }
    }
  });

  let updatedCount = 0;

  await prisma.$transaction(async (tx) => {
    for (const client of clients) {
      const newNextVisitDate = calculateNextVisitDate(normalizeToWorkDate(new Date()), client.visitType);

      await tx.client.update({
        where: { id: client.id },
        data: {
          status: ClientStatuses.ACTIVE,
          nextVisitDate: newNextVisitDate
        }
      });

      await tx.visitHistory.create({
        data: {
          clientId: client.id,
          visitedById: user.id,
          previousStatus: client.status,
          newStatus: ClientStatuses.ACTIVE,
          note: note || "تم التعامل مع المنطقة بالكامل",
          previousNextVisitDate: client.nextVisitDate,
          newNextVisitDate,
          visitDate: new Date()
        }
      });

      updatedCount += 1;
    }
  });

  return {
    region,
    updatedCount
  };
}

module.exports = {
  listClients,
  getClientById,
  handleClientVisit,
  handleRegionClients,
  enforceClientScope,
  canRetryRejectedClient
};
