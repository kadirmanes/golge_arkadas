export interface Contact {
  id: string;
  name: string;
  phone: string;
}

export type AppState = 'setup' | 'active' | 'alert' | 'triggered';
