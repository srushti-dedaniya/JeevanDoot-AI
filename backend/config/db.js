import mongoose from 'mongoose';
import env from './env.js';

const connectDB = async () => {
  const options = {
    autoIndex: env.IS_DEV,
    serverSelectionTimeoutMS: 10000,
  };

  try {
    const connection = await mongoose.connect(env.MONGODB_URI, options);
    console.log(
      `[db] MongoDB connected: ${connection.connection.host}/${connection.connection.name}`
    );
    return connection;
  } catch (error) {
    console.error('[db] MongoDB connection failed:', error.message);
    throw error;
  }
};

mongoose.connection.on('error', (error) => {
  console.error('[db] MongoDB runtime error:', error.message);
});

mongoose.connection.on('disconnected', () => {
  console.warn('[db] MongoDB disconnected');
});

export default connectDB;
