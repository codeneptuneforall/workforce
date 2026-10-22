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

export async function disconnectDatabase(): Promise<void> {
  await mongoose.connection.close();
}

function redact(uri: string): string {
  return uri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:***@');
}
