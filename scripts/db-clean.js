require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { PrismaLibSql } = require('@prisma/adapter-libsql');

const url = process.env.TURSO_DATABASE_URL ?? "file:./prisma/dev.db";
const authToken = process.env.TURSO_AUTH_TOKEN;

const adapter = new PrismaLibSql({ url, authToken });
const prisma = new PrismaClient({ adapter });

async function clean() {
  console.log('Cleaning database user data...');
  try {
    await prisma.comment.deleteMany();
    await prisma.postTag.deleteMany();
    await prisma.like.deleteMany();
    await prisma.meToo.deleteMany();
    await prisma.report.deleteMany();
    await prisma.appeal.deleteMany();
    await prisma.collection.deleteMany();
    await prisma.notification.deleteMany();
    await prisma.post.deleteMany();
    await prisma.guest.deleteMany();
    await prisma.user.deleteMany();
    console.log('Database cleaned successfully.');
  } catch (err) {
    console.error('Error cleaning database:', err);
  } finally {
    await prisma.$disconnect();
  }
}

clean();
