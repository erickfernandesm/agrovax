import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

/**
 * Concede (ou retira) o acesso de administrador da plataforma a um usuario.
 *   npx tsx scripts/make-admin.ts <email>            concede
 *   npx tsx scripts/make-admin.ts <email> --revoke   retira
 */
const [email, flag] = process.argv.slice(2);
if (!email) {
  console.error('Uso: tsx scripts/make-admin.ts <email> [--revoke]');
  process.exit(1);
}

const prisma = new PrismaClient();
try {
  const isPlatformAdmin = flag !== '--revoke';
  await prisma.user.update({ where: { email: email.toLowerCase() }, data: { isPlatformAdmin } });
  console.log(`${email}: administrador = ${isPlatformAdmin}`);
} finally {
  await prisma.$disconnect();
}
