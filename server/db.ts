import mongoose from 'mongoose';
import { config } from './config';

export async function connectDatabase(): Promise<typeof mongoose> {
  mongoose.set('strictQuery', true);
  await mongoose.connect(config.mongoUri, {
    serverSelectionTimeoutMS: 10000,
    autoIndex: true
  });
  console.log(`[db] connected to ${redact(config.mongoUri)}`);
  return mongoose;
}

/** True while the MongoDB connection is open (mongoose readyState 1). */
export function isDatabaseConnected(): boolean {
  return mongoose.connection.readyState === 1;
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.connection.close();
}

function redact(uri: string): string {
  return uri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:***@');
}
