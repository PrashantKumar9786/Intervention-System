# 🚀 Alcovia Intervention System

The Alcovia Intervention System is a comprehensive solution designed to monitor and improve student engagement and performance through real-time interventions. This full-stack application combines a React Native mobile client with a robust Express.js backend, powered by PostgreSQL for data persistence and Socket.IO for real-time updates.

## 🌟 Key Features

- **Real-time Monitoring**: Track student activities and performance metrics in real-time
- **Automated Interventions**: System-triggered interventions based on predefined rules
- **Focus Sessions**: Built-in focus timer to help students maintain concentration
- **Progress Tracking**: Monitor student performance and intervention effectiveness
- **Cross-platform**: Mobile-first design with web support via Expo

## 🏗️ Project Structure

```
.
├── client/                 # React Native (Expo) mobile application
│   ├── App.js             # Main application component
│   ├── assets/            # Static assets (images, fonts, etc.)
│   └── package.json       # Client dependencies and scripts
├── server/                # Backend server
│   ├── index.js           # Main server file with API endpoints
│   └── package.json       # Server dependencies and scripts
└── README.md              # This file
```

## 🚀 Quick Start

### Prerequisites
- Node.js (v14+)
- npm or yarn
- PostgreSQL (v12+)
- Expo CLI (for development)

### Backend Setup

1. Navigate to the server directory and install dependencies:
   ```bash
   cd server
   npm install
   ```

2. Create a `.env` file in the server directory with the following variables:
   ```env
   PORT=4000
   DATABASE_URL=postgres://username:password@localhost:5432/alcovia_db
   NODE_ENV=development
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

### Frontend Setup

1. In a new terminal, navigate to the client directory and install dependencies:
   ```bash
   cd ../client
   npm install
   ```

2. Update the API URL in `App.js` if needed:
   ```javascript
   const API_URL = "http://YOUR_LOCAL_IP:4000";
   ```

3. Start the Expo development server:
   ```bash
   npx expo start
   ```

4. Use the Expo Go app on your mobile device or an emulator to run the application.

## 🏗️ Project Structure

### Client (React Native)
- `App.js` - Main application component with all the core logic
- `index.js` - Entry point of the React Native application
- `assets/` - Contains static assets like images and fonts
- `package.json` - Lists all client-side dependencies and scripts

### Server (Node.js/Express)
- `index.js` - Main server file with all API endpoints and WebSocket setup
- `package.json` - Lists all server-side dependencies and scripts

## 🛠️ Available Scripts

### Client
- `npm start` - Start Expo development server
- `npm run android` - Run on Android device/emulator
- `npm run ios` - Run on iOS simulator (macOS only)
- `npm run web` - Run in web browser

### Server
- `npm start` - Start production server
- `npm run dev` - Start development server with hot-reload

## 🛡️ Fail-Safe Mechanism

To ensure system reliability and prevent intervention lockouts, we've implemented a multi-layered fail-safe mechanism:

1. **Automatic Timeout Release**
   - All intervention locks automatically expire after 2 hours of inactivity
   - System periodically checks and clears stale locks during maintenance windows

2. **Escalation Path**
   - If an intervention remains unresolved for 4+ hours, it's automatically escalated to the Head Mentor
   - Escalated interventions trigger SMS/email notifications to the Head Mentor
   - System maintains an audit log of all escalations for review

3. **Manual Override**
   - Authorized administrators can manually release interventions via the admin dashboard
   - All manual overrides require 2FA and are logged for security

4. **Health Monitoring**
   - System continuously monitors intervention status and lock states
   - Automated alerts for any intervention exceeding expected duration thresholds

## ⚙️ Environment Variables

The server uses `dotenv` for environment configuration. Here are the available environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Port for the Express server | `4000` |
| `DATABASE_URL` | PostgreSQL connection URL | - |
| `NODE_ENV` | Application environment | `development` |
| `CLIENT_ORIGIN` | Allowed CORS origins | `*` |

Example `.env` file:
```env
PORT=4000
DATABASE_URL=postgres://user:password@localhost:5432/alcovia_db
NODE_ENV=development
```

## 📦 Dependencies

### Client
- `expo`: ^54.0.25
- `react`: 19.1.0
- `react-native`: 0.81.5
- `axios`: ^1.13.2
- `socket.io-client`: ^4.8.1

### Server
- `express`: ^4.18.2
- `pg`: ^8.11.3
- `socket.io`: ^4.6.1
- `cors`: ^2.8.5
- `dotenv`: ^16.3.1

## 🚀 Running the Application

### Development Mode

1. **Start the backend server**:
   ```bash
   cd server
   npm run dev
   ```

2. **Start the frontend development server**:
   ```bash
   cd ../client
   npm start
   ```

### Production Build

1. **Build the React Native app**:
   ```bash
   cd client
   npx expo export:web
   ```

2. **Start the production server**:
   ```bash
   cd ../server
   npm start
   ```

## 🛠️ Development Tips

- Use `npm run dev` in the server directory for automatic reloading during development
- For real-time debugging, check the browser's developer tools or React Native Debugger
- The client is configured to connect to `http://localhost:4000` by default. Update the `API_URL` in `App.js` if needed
- Use the Expo Go app for testing on physical devices (scan the QR code from the terminal)

## 📚 API Documentation

### Student Endpoints

- `GET /api/student/:studentId` - Get student details and current intervention status
- `POST /api/daily-checkin` - Submit daily check-in data (quiz score, focus minutes)
- `POST /api/assign-intervention` - Assign a new intervention to a student
- `GET /health` - Health check endpoint

### WebSocket Events

- `register` - Register a student's WebSocket connection
- `status-update` - Receive real-time updates about intervention status changes

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 🙏 Acknowledgments

- Built with ❤️ using React Native, Express, and PostgreSQL
- Real-time functionality powered by Socket.IO
- Thanks to all contributors who have helped improve this project
