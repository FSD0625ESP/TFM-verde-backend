# Express README

This is a simple Express application for a RESTful API.

## Installation

Run `npm install` to install the dependencies.

## Running the application

Run `npm run start` to start the application in production mode.

Run `npm run dev` to start the application in development mode with nodemon.

## Configuration

The application uses a `.env` file to store environment variables. You can create a `.env` file in the root directory of the project with the following format:

## Environment Variables

The application uses the following environment variables:

- `PORT`: The port to listen on.
- `MONGO_URI`: The MongoDB connection string.
- `JWT_SECRET`: The secret key for JWT authentication.
- `JWT_EXPIRE`: The expiration time for JWT tokens.
