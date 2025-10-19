# NextDoorLearn

A tutoring and mentorship platform aimed to uplift low income and underprivileged students.

## Features

- **User Authentication**: Register as student or tutor with email/password
- **Profile Management**: Create detailed profiles with subjects and availability
- **Tutor Discovery**: Browse and search for tutors by subject
- **Connection System**: Students can request connections with tutors
- **Messaging**: Simple chat system between connected users
- **Role-based Dashboard**: Different views for students and tutors

## Tech Stack

- **Frontend**: React + Vite + TailwindCSS
- **Backend**: Node.js + Express + SQLite
- **Authentication**: JWT with bcrypt
- **Deployment**: Vercel (frontend), local backend

## Quick Start

### Backend Setup
```bash
cd backend
npm install
npm start
```
Backend runs on http://localhost:3001

### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
Frontend runs on http://localhost:5173

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user

### Users
- `GET /api/users/profile` - Get user profile
- `PUT /api/users/profile` - Update user profile
- `GET /api/users/tutors` - Get all tutors

### Connections
- `POST /api/connections/request` - Send connection request
- `GET /api/connections/requests` - Get connection requests (tutors)
- `PUT /api/connections/:id/respond` - Accept/reject connection
- `GET /api/connections/my-connections` - Get user's connections

### Messages
- `POST /api/messages/send` - Send message
- `GET /api/messages/:connectionId` - Get messages for connection
- `GET /api/messages` - Get all conversations

## Database Schema

- **users**: Basic user information and authentication
- **tutor_profiles**: Tutor-specific information (subjects, rates)
- **student_profiles**: Student-specific information (grade level, needs)
- **connections**: Tutor-student connection requests and status
- **messages**: Chat messages between connected users

## Development Notes

This is an MVP built in 3 hours with the following simplifications:
- No real-time messaging (polling-based)
- No video calls (text messaging only)
- No email verification
- No payment processing
- Basic UI with TailwindCSS
- SQLite database (no external setup needed)

## Future Enhancements

- Email verification system
- Document upload for tutor verification
- Real-time messaging with WebSockets
- Video call integration (Zoom API)
- Payment processing (Stripe)
- Advanced search and filtering
- Mobile responsiveness improvements
- Notification system
