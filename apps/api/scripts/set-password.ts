import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

/**
 * Utilitario de desenvolvimento: define a senha de um usuario.
 *   npx tsx scripts/set-password.ts <email> <nova-senha>
 */
const [email, password] = process.argv.slice(2);
if (!email || !password || password.length < 8) {
  console.error('Uso: tsx scripts/set-password.ts <email> <nova-senha com 8+ caracteres>');
  process.exit(1);
}

const prisma = new PrismaClient();
try {
  await prisma.user.update({
    where: { email: email.toLowerCase() },
    data: { passwordHash: await bcrypt.hash(password, 12) },
  });
  // Sessoes antigas deixam de valer, como na redefinicao pelo app.
  await prisma.refreshToken.updateMany({
    where: { user: { email: email.toLowerCase() }, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  console.log(`Senha de ${email} atualizada.`);
} finally {
  await prisma.$disconnect();
}
