import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import { Report } from '../src/models/report.model.js';

// GL-443: one-off. The (reporter, targetType, targetId) unique index became
// partial on `status: 'open'`. Mongoose won't replace an existing index that
// has the same keys but different options — syncIndexes() would fail on the
// name clash — so the old one is dropped here first, then syncIndexes()
// builds the new one from the schema.
//
// Safe to run more than once: if the index is already partial, nothing is
// dropped. Run from server/ with MONGODB_URI pointing at the target database:
//
//   node scripts/rebuild-report-index.js

const INDEX_KEY = { reporter: 1, targetType: 1, targetId: 1 };

const hasIndexKey = (index) => JSON.stringify(index.key) === JSON.stringify(INDEX_KEY);

const printIndexes = (label, indexes) => {
  console.log(`${label}:`);
  for (const index of indexes) {
    const options = [
      index.unique && 'unique',
      index.partialFilterExpression && `partial ${JSON.stringify(index.partialFilterExpression)}`,
    ].filter(Boolean);
    console.log(`  ${index.name} ${JSON.stringify(index.key)} ${options.join(', ')}`);
  }
};

const run = async () => {
  await mongoose.connect(env.mongoUri);
  console.log(`Connected to database: ${mongoose.connection.name}`);

  const before = await Report.collection.indexes();
  printIndexes('Indexes before', before);

  const oldIndex = before.find((index) => hasIndexKey(index) && !index.partialFilterExpression);
  if (oldIndex) {
    await Report.collection.dropIndex(oldIndex.name);
    console.log(`Dropped old index: ${oldIndex.name}`);
  } else {
    console.log('No non-partial index on these keys — nothing to drop.');
  }

  const dropped = await Report.syncIndexes();
  console.log(`syncIndexes dropped: ${dropped.length ? dropped.join(', ') : 'none'}`);

  const after = await Report.collection.indexes();
  printIndexes('Indexes after', after);

  const newIndex = after.find(
    (index) =>
      hasIndexKey(index) && index.unique && index.partialFilterExpression?.status === 'open',
  );
  if (!newIndex) {
    throw new Error('Partial unique index was not built.');
  }
  console.log(`Partial unique index in place: ${newIndex.name}`);

  await mongoose.connection.close();
};

run().catch(async (err) => {
  console.error('Rebuild failed:', err.message);
  await mongoose.connection.close();
  process.exit(1);
});
