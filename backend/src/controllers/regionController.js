const prisma = require("../config/prisma");
const asyncHandler = require("../middlewares/asyncHandler");
const { Roles } = require("../constants/enums");
const { normalizeToWorkDate } = require("../utils/dateUtils");
const { createHttpError } = require("../utils/httpError");
const { handleRegionClients } = require("../services/clientService");

async function getRegionSummary() {
  const regions = await prisma.region.findMany({
    orderBy: { code: "asc" },
    include: {
      _count: {
        select: {
          clients: true,
          users: true
        }
      }
    }
  });

  const today = normalizeToWorkDate(new Date());

  const dueByRegion = await prisma.client.groupBy({
    by: ["regionId"],
    _count: { _all: true },
    where: {
      nextVisitDate: { lte: today },
      status: { not: "REJECTED" }
    }
  });

  const noAnswerByRegion = await prisma.client.groupBy({
    by: ["regionId"],
    _count: { _all: true },
    where: {
      status: "NO_ANSWER"
    }
  });

  const dueMap = new Map(dueByRegion.map((item) => [item.regionId, item._count._all]));
  const noAnswerMap = new Map(noAnswerByRegion.map((item) => [item.regionId, item._count._all]));

  return regions.map((region) => ({
    id: region.id,
    code: region.code,
    name: region.name,
    clientsCount: region._count.clients,
    representativesCount: region._count.users,
    dueClientsCount: dueMap.get(region.id) || 0,
    noAnswerCount: noAnswerMap.get(region.id) || 0
  }));
}

const listRegions = asyncHandler(async (req, res) => {
  const items = await getRegionSummary();

  const filteredItems =
    req.user.role === Roles.ADMIN ? items : items.filter((item) => Number(item.id) === Number(req.user.regionId));

  res.json({ items: filteredItems });
});

const getRegionDetails = asyncHandler(async (req, res) => {
  const regionId = Number(req.params.id);

  if (req.user.role === Roles.REPRESENTATIVE && Number(req.user.regionId) !== regionId) {
    throw createHttpError(403, "لا يمكنك الوصول إلى هذه المنطقة");
  }

  const region = await prisma.region.findUnique({
    where: { id: regionId },
    include: {
      users: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true
        }
      },
      _count: {
        select: {
          clients: true,
          users: true
        }
      }
    }
  });

  if (!region) {
    throw createHttpError(404, "المنطقة غير موجودة");
  }

  res.json({
    item: {
      id: region.id,
      code: region.code,
      name: region.name,
      clientsCount: region._count.clients,
      representativesCount: region._count.users,
      representatives: region.users
    }
  });
});

const handleWholeRegion = asyncHandler(async (req, res) => {
  const regionId = Number(req.params.id);

  const result = await handleRegionClients({
    regionId,
    user: req.user,
    note: req.body.note
  });

  res.json({
    message: "تم التعامل مع عملاء المنطقة",
    item: {
      regionId: result.region.id,
      regionName: result.region.name,
      updatedCount: result.updatedCount
    }
  });
});

module.exports = {
  listRegions,
  getRegionDetails,
  handleWholeRegion,
  getRegionSummary
};
