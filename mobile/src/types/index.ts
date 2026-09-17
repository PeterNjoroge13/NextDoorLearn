export type Role = 'student' | 'tutor';

export type User = {
  id: number;
  email: string;
  role: Role;
  name: string;
  bio?: string;
  emailVerified?: boolean;
  isAdmin?: boolean;
};

export type AuthResponse = {
  token: string;
  refreshToken: string;
  user: User;
  message?: string;
};

export type Tutor = {
  id: number;
  name: string;
  headline?: string;
  bio?: string;
  avatar_url?: string;
  location?: string;
  subjects?: string[];
  hourly_rate?: number;
  tutoring_mode?: string;
  experience_years?: number;
  teaching_style?: string;
  education?: string;
  motivation?: string;
  averageRating?: number;
  totalReviews?: number;
  matchScore?: number;
  matchReasons?: string[];
};

export type Session = {
  id: number;
  title: string;
  subject?: string;
  scheduled_date: string;
  start_time: string;
  end_time: string;
  status: string;
  confirmation_status?: string;
  meeting_link?: string;
  tutor_name?: string;
  student_name?: string;
  connection_id?: number;
};

export type Conversation = {
  connection_id: number;
  other_user_id?: number;
  other_user_name?: string;
  tutor_name?: string;
  student_name?: string;
  name?: string;
  avatar_url?: string;
  last_message?: string;
  last_message_time?: string;
  unread_count?: number;
};

export type ApiErrorShape = { error?: string; message?: string; code?: string };
