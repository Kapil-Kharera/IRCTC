// Prisma Client ko import kar rahe hain.
// Prisma database ke saath interact karne ke liye ORM provide karta hai.
// import { PrismaClient } from "@prisma/client/extension";
import { PrismaClient } from "../generated/prisma/client.js";

// PostgreSQL ke liye Prisma adapter.
// Ye Prisma ko PostgreSQL database se connect karne mein help karta hai.
import { PrismaPg } from "@prisma/adapter-pg";

// Application ki configuration, jisme DATABASE_URL bhi hai.
import { config } from "./index.js";

// ------------------------------------------------------------
// Global Prisma instance
// ------------------------------------------------------------
// Development environment mein hot-reload ki wajah se baar-baar
// PrismaClient ke naye instances create ho sakte hain.
// Isliye globalThis par existing Prisma instance ko reuse karte hain.
const globalForPrisma = globalThis as typeof globalThis & {
    prisma: PrismaClient | undefined;
};

// Agar Prisma ka instance pehle se globalThis par nahi hai,
// tabhi naya PrismaClient create karo.
if (!globalForPrisma.prisma) {

    // PostgreSQL adapter create kar rahe hain.
    // DATABASE_URL se database connection establish hoga.
    const adapter = new PrismaPg({
        connectionString: config.DATABASE_URL
    });

    // Prisma Client ka ek hi reusable instance create kar rahe hain.
    // log option se errors aur warnings console mein milenge.
    globalForPrisma.prisma = new PrismaClient({
        adapter,
        log: ["error", "warn"]
    });
}

// Ab same Prisma instance ko poori application mein import karke use kar sakte hain.
export const prisma = globalForPrisma.prisma;
