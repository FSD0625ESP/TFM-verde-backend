const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

let mongoServer;

const connectInMemoryMongo = async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri, { dbName: "jest" });
};

const clearDatabase = async () => {
    const collections = await mongoose.connection.db.collections();
    for (const collection of collections) {
        await collection.deleteMany({});
    }
};

const disconnectInMemoryMongo = async () => {
    await mongoose.disconnect();
    if (mongoServer) {
        await mongoServer.stop();
        mongoServer = undefined;
    }
};

module.exports = {
    connectInMemoryMongo,
    clearDatabase,
    disconnectInMemoryMongo,
};
