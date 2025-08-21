const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

let mongod;


jest.setTimeout(60000);

beforeAll(async () => {
  try {

    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }


    mongod = await MongoMemoryServer.create({
      instance: {
        port: 27018,
        dbName: 'snaplove_test'
      }
    });

    const uri = mongod.getUri();
    console.log('Test MongoDB URI:', uri);


    process.env.MONGODB_URI = uri;
    process.env.JWT_SECRET = 'test_jwt_secret_key_for_testing_only';
    process.env.NODE_ENV = 'test';


    await mongoose.connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('Connected to test database');
  } catch (error) {
    console.error('Test setup error:', error);
    throw error;
  }
});

afterAll(async () => {
  try {

    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    

    if (mongod) {
      await mongod.stop();
    }
  } catch (error) {
    console.error('Test cleanup error:', error);
  }
});


beforeEach(async () => {
  if (mongoose.connection.readyState === 1) {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      const collection = collections[key];
      await collection.deleteMany({});
    }
  }
});