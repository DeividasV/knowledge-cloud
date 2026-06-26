import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const [email, password, name] = process.argv.slice(2);

  if (!email || !password) {
    console.error("Usage: npx tsx scripts/create-user.ts <email> <password> [name]");
    process.exit(1);
  }

  if (password.length < 6) {
    console.error("Password must be at least 6 characters long.");
    process.exit(1);
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  const hashed = await bcrypt.hash(password, 10);

  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: { password: hashed, ...(name ? { name } : {}) },
    });
    console.log(`Updated password for existing user: ${email}`);
  } else {
    await prisma.user.create({
      data: {
        email,
        password: hashed,
        name: name || email.split("@")[0],
      },
    });
    console.log(`Created user: ${email}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
