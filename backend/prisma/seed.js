const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const path = require("path");
const dotenv = require("dotenv");
const { PrismaClient, Role, VisitType, ClientStatus } = require("@prisma/client");

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const prisma = new PrismaClient();

const regionNames = [
  "المنطقة الأولى",
  "المنطقة الثانية",
  "المنطقة الثالثة",
  "المنطقة الرابعة",
  "المنطقة الخامسة",
  "المنطقة السادسة"
];

function getSafeWorkDate(offsetDays = 0) {
  const now = new Date();
  const base = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), Math.min(now.getUTCDate(), 28)));
  base.setUTCDate(base.getUTCDate() + offsetDays);
  return base;
}

function toPositiveInteger(value, fallback) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.floor(parsed);
}

function generateStrongPassword(length = 16) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*";
  let password = "";

  while (password.length < length) {
    const bytes = crypto.randomBytes(length);

    for (let index = 0; index < bytes.length && password.length < length; index += 1) {
      password += alphabet[bytes[index] % alphabet.length];
    }
  }

  return password;
}

async function seedRegions() {
  const regions = [];

  for (let index = 0; index < regionNames.length; index += 1) {
    const code = index + 1;
    const region = await prisma.region.upsert({
      where: { code },
      update: { name: regionNames[index] },
      create: {
        code,
        name: regionNames[index]
      }
    });

    regions.push(region);
  }

  return regions;
}

async function seedUsers(regions) {
  const createdCredentials = [];
  const adminEmail = process.env.SEED_ADMIN_EMAIL || "admin@crm.local";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || generateStrongPassword();

  let admin = await prisma.user.findUnique({
    where: { email: adminEmail }
  });

  if (!admin) {
    const adminPasswordHash = await bcrypt.hash(adminPassword, 10);
    admin = await prisma.user.create({
      data: {
        name: "مدير النظام",
        email: adminEmail,
        passwordHash: adminPasswordHash,
        role: Role.ADMIN
      }
    });

    createdCredentials.push({
      role: "ADMIN",
      email: adminEmail,
      password: adminPassword
    });
  }

  const repEmailPrefix = process.env.SEED_REP_EMAIL_PREFIX || "rep";
  const repCount = toPositiveInteger(process.env.SEED_REP_COUNT, regions.length);
  const sharedRepPassword = process.env.SEED_REP_DEFAULT_PASSWORD || null;

  for (let index = 0; index < repCount; index += 1) {
    const region = regions[index % regions.length];
    const email = `${repEmailPrefix}${index + 1}@crm.local`;

    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          regionId: region.id,
          role: Role.REPRESENTATIVE,
          isActive: true
        }
      });

      continue;
    }

    const password = sharedRepPassword || generateStrongPassword();
    const passwordHash = await bcrypt.hash(password, 10);

    await prisma.user.create({
      data: {
        name: `مندوب ${index + 1}`,
        email,
        passwordHash,
        role: Role.REPRESENTATIVE,
        regionId: region.id
      }
    });

    createdCredentials.push({
      role: "REPRESENTATIVE",
      email,
      password
    });
  }

  return {
    adminId: admin.id,
    createdCredentials
  };
}

async function seedClients(regions, adminId) {
  if (!adminId) {
    return;
  }

  const existingCount = await prisma.client.count();
  if (existingCount > 0) {
    return;
  }

  const samples = [
    {
      name: "مؤسسة الهدى",
      phone: "01000000001",
      address: "شارع التحرير",
      products: "منتج A, منتج B",
      visitType: VisitType.WEEKLY,
      status: ClientStatus.ACTIVE,
      offset: 0
    },
    {
      name: "شركة النور",
      phone: "01000000002",
      address: "شارع الملك فيصل",
      products: "منتج C",
      visitType: VisitType.BIWEEKLY,
      status: ClientStatus.NO_ANSWER,
      offset: -1
    },
    {
      name: "مخزن الأمانة",
      phone: "01000000003",
      address: "حي الجامعة",
      products: "منتج D, منتج E",
      visitType: VisitType.MONTHLY,
      status: ClientStatus.REJECTED,
      offset: 2
    }
  ];

  for (let regionIndex = 0; regionIndex < regions.length; regionIndex += 1) {
    const region = regions[regionIndex];

    for (let sampleIndex = 0; sampleIndex < samples.length; sampleIndex += 1) {
      const sample = samples[sampleIndex];
      await prisma.client.create({
        data: {
          name: `${sample.name} ${regionIndex + 1}`,
          phone: sample.phone,
          address: sample.address,
          products: sample.products,
          visitType: sample.visitType,
          status: sample.status,
          nextVisitDate: getSafeWorkDate(sample.offset),
          regionId: region.id,
          createdById: adminId
        }
      });
    }
  }
}

async function main() {
  const regions = await seedRegions();
  const { adminId, createdCredentials } = await seedUsers(regions);
  await seedClients(regions, adminId);

  console.log("Seed completed.");

  if (createdCredentials.length === 0) {
    console.log("No new users created in this seed run.");
    return;
  }

  console.log("Generated credentials for newly created users:");
  for (const credential of createdCredentials) {
    console.log(`${credential.role}: ${credential.email} / ${credential.password}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
