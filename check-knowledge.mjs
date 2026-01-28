import { MongoClient } from 'mongodb';

const client = new MongoClient('mongodb://localhost:27017');

async function check() {
  await client.connect();
  const db = client.db('knowledge');
  const col = db.collection('context');
  
  const stats = {
    MCPs: await col.countDocuments({ type: 'MCPs' }),
    Memories: await col.countDocuments({ type: 'Memories' }),
    Rules: await col.countDocuments({ type: 'Rules' }),
    Skills: await col.countDocuments({ type: 'Skills' }),
  };
  console.log('Knowledge Stats:', JSON.stringify(stats, null, 2));
  
  const docs = await col.find({}).project({ type: 1, name: 1, description: 1 }).toArray();
  console.log('\nAll Documents:');
  for (const d of docs) {
    console.log(`  [${d.type}] ${d.name}: ${d.description || ''}`);
  }
  
  await client.close();
}

check().catch(console.error);
