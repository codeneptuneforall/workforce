import { Server as IOServer } from 'socket.io';
import { config } from './config';

/**
 * Socket.io instance shared between the Express server and Bug Tracker routes.
 * Created here (unattached) to avoid a circular import between index.ts and
 * routes/bugTracker.ts. Attached to the HTTP server in index.ts.
 */
export const io = new IOServer({
  cors: {
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      if (!origin) return callback(null, true);
      if (config.clientOrigins.includes(origin)) return callback(null, true);
      callback(null, false);
    },
    credentials: true,
  },
});