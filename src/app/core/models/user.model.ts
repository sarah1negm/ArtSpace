export type Role = 'student' | 'accountant' | 'admin';

export interface User {
  id: string;
  username: string;
  name: string;
  email: string;
  picture: string;          // data URL or image path
  passwordHash: string;     // never store the plain password
  cardLast4: string;        // never store the full card number
  preferences: { theme: 'light' | 'dark'; newsletter: boolean };
  role: Role;
}