import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { env } from "../src/config/env.js";
import { User } from "../src/models/user.model.js";

const SEED_PASSWORD = "Password123!";

const seedUsers = [
  { email: "seeker@giglanka.test", role: "seeker" },
  { email: "business@giglanka.test", role: "business" },
  { email: "admin@giglanka.test", role: "admin" },
];

const run = async () => {
  await mongoose.connect(env.mongoUri);

  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 10);

  for (const { email, role } of seedUsers) {
    await User.findOneAndUpdate(
      { email },
      { $setOnInsert: { email, role, passwordHash } },
      { upsert: true, returnDocument: "after" }
    );
    console.log(`Seeded ${role}: ${email}`);
  }

  await mongoose.connection.close();
};

run().catch((err) => {
  console.error("Seed failed:", err.message);
  process.exit(1);
});
